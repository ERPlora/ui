/**
 * The open request of the live stream: `GET <liveUrl>?s=<subscriptions>` read with `fetch` + `ReadableStream`,
 * each frame routed to its subscriptions, and what ends it (`bye`, a network or HTTP error, the end of the body or
 * 45 s without frames), after which the next attempt waits a backoff from the last `retry:`.
 */
import { backoffDelay } from "./backoff";
import { type ApiError, LIVE_ERROR_STATUS, parseErrorEnvelope } from "./errors";
import { createSseParser, type SseFrame } from "./sse-parser";
import { cancel, disconnect, setStatus, type Connection, type StreamState } from "./stream-state";
import { encodeSubscriptions, limitWarnings } from "./subscriptions";

export const WATCHDOG_MS = 45000;

type EventFrame = Extract<SseFrame, { type: "event" }>;
type Payload = Record<string, unknown>;

function parseJson(data: string): Payload | undefined {
  try {
    const value: unknown = JSON.parse(data);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Payload)
      : undefined;
  } catch {
    return undefined;
  }
}

function scheduleReconnect(s: StreamState): void {
  if (s.closed || s.paused) return;
  if (s.registry.active().length === 0) {
    setStatus(s, "idle");
    return;
  }
  setStatus(s, "reconnecting");
  cancel(s, "backoff");
  s.timers.backoff = s.opts.setTimeout(() => {
    s.timers.backoff = undefined;
    connect(s);
  }, backoffDelay(s.attempt++, s.retryMs, s.random));
}

function fail(s: StreamState, conn: Connection, error?: ApiError): void {
  if (conn !== s.current) return;
  disconnect(s);
  if (error) s.registry.broadcast({ type: "error", error });
  if (error && leaving(s, error)) return;
  scheduleReconnect(s);
}

/** Whether the page leaves because of `error`; then the stream stops for good. */
function leaving(s: StreamState, error: ApiError): boolean {
  if (!s.opts.onError) return false;
  let leaves = false;
  try {
    leaves = s.opts.onError(error);
  } catch (err) {
    s.logger.error("live: the error hook failed", err);
  }
  if (!leaves) return false;
  s.left = true;
  cancel(s, "debounce");
  cancel(s, "backoff");
  disconnect(s);
  setStatus(s, "closed");
  return true;
}

function checkWatchdog(s: StreamState): void {
  s.timers.watchdog = undefined;
  if (!s.current) return;
  const idle = s.opts.now() - s.lastActivity;
  if (idle >= WATCHDOG_MS) {
    s.logger.warn(`live: no frame for ${WATCHDOG_MS / 1000} s, reconnecting`);
    fail(s, s.current);
  } else {
    s.timers.watchdog = s.opts.setTimeout(() => checkWatchdog(s), WATCHDOG_MS - idle);
  }
}

function deliverResult(s: StreamState, payload: Payload, id: string | undefined): void {
  if (!id) return;
  const rev = payload.rev as number;
  if (s.opts.onResult) {
    try {
      s.opts.onResult(id, rev);
    } catch (err) {
      s.logger.error("live: the result hook failed", err);
    }
  }
  s.registry.emitTo(id, { type: "result", data: payload.data, rev });
}

function deliverError(s: StreamState, payload: Payload, id: string | undefined): void {
  const error = parseErrorEnvelope(LIVE_ERROR_STATUS, payload);
  if (payload.id === undefined) s.registry.broadcast({ type: "error", error });
  else if (id) s.registry.emitTo(id, { type: "error", error });
  leaving(s, error);
}

function onEvent(s: StreamState, conn: Connection, { event, data }: EventFrame): void {
  if (event === "heartbeat") return;
  if (event === "bye") {
    fail(s, conn);
    return;
  }
  if (event !== "hello" && event !== "result" && event !== "error") return;
  const payload = parseJson(data);
  if (!payload || (event === "result" && typeof payload.rev !== "number")) {
    s.logger.error(`live: malformed "${event}" frame`, data);
    return;
  }
  if (event === "hello") {
    s.attempt = 0;
    setStatus(s, "live");
    return;
  }
  const id = typeof payload.id === "string" ? payload.id : undefined;
  if (event === "result") deliverResult(s, payload, id);
  else deliverError(s, payload, id);
}

function onFrame(s: StreamState, conn: Connection, frame: SseFrame): void {
  if (conn !== s.current) return;
  if (frame.type === "retry") {
    if (frame.ms > 0) s.retryMs = frame.ms;
    return;
  }
  onEvent(s, conn, frame);
}

async function run(s: StreamState, conn: Connection, url: string): Promise<void> {
  try {
    const res = await s.opts.fetchImpl(url, {
      method: "GET",
      headers: s.opts.headers.liveHeaders(),
      signal: conn.controller.signal,
      cache: "no-store",
      credentials: "same-origin",
    });
    if (conn !== s.current) return;
    if (!res.ok || !res.body) {
      const body = await res.text().catch(() => undefined);
      fail(s, conn, parseErrorEnvelope(res.status, body));
      return;
    }
    const parser = createSseParser((frame) => onFrame(s, conn, frame));
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (conn !== s.current) return;
      if (done) break;
      s.lastActivity = s.opts.now();
      parser.push(value);
    }
    parser.flush();
    fail(s, conn);
  } catch (err) {
    if (conn !== s.current) return;
    s.logger.warn("live: connection lost", err);
    fail(s, conn);
  }
}

/** Opens the stream with the active subscriptions, replacing the open one; none → `idle`. */
export function connect(s: StreamState): void {
  disconnect(s);
  if (s.left) return;
  const list = s.registry.active();
  if (list.length === 0) {
    setStatus(s, "idle");
    return;
  }
  const query = encodeSubscriptions(list);
  if (query !== s.warnedQuery) {
    s.warnedQuery = query;
    for (const warning of limitWarnings(list.length, query)) s.logger.warn(warning);
  }
  const conn: Connection = { controller: new AbortController(), query };
  s.current = conn;
  setStatus(s, s.status === "reconnecting" ? "reconnecting" : "connecting");
  s.lastActivity = s.opts.now();
  s.timers.watchdog = s.opts.setTimeout(() => checkWatchdog(s), WATCHDOG_MS);
  const separator = s.opts.liveUrl.includes("?") ? "&" : "?";
  void run(s, conn, `${s.opts.liveUrl}${separator}s=${query}`);
}
