/**
 * One live stream per tab: `GET /api/live?s=<subscriptions>` read with `fetch` + `ReadableStream`
 * (so the SDK can send its own headers) and parsed by `createSseParser`.
 *
 * - Subscriptions are shared by `(op, params)` with a refcount; any change of the active set
 *   closes and reopens the stream once, 150 ms after the last change.
 * - `bye`, a network error, an HTTP error or 45 s without frames → `reconnecting` with backoff
 *   from the last `retry:` (×2 up to 30 s, with jitter). On reconnect the server resends every result.
 * - Hidden for more than 60 s → the stream is closed; visible again → reopened at once.
 * - `onError` sees every error envelope of the host (the HTTP answer to an open, an `error` frame) after its
 *   listeners; when it says the page is leaving (the host no longer serves the app: `host-closed.ts`), the
 *   stream stops for good (`closed`).
 * - For the SDK above it: `subscribe` returns its subscription id, `subscriptions(op)` lists the
 *   active ones of an operation, `onResult` sees every result frame once (before its listeners)
 *   and `reconnect()` reopens the stream now (the server re-runs every subscription).
 */
import { backoffDelay, DEFAULT_RETRY_MS } from "./backoff";
import { type ApiError, LIVE_ERROR_STATUS, parseErrorEnvelope } from "./errors";
import type { HeaderProvider } from "./headers";
import { createSseParser, type SseFrame } from "./sse-parser";
import { createSubscriptionRegistry, type StreamStatus, type SubListener } from "./subscription-registry";
import { encodeSubscriptions, limitWarnings } from "./subscriptions";

export type { StreamStatus, SubEvent, SubListener } from "./subscription-registry";
export type Unsubscribe = () => void;

/** Unsubscribe function that also carries the wire id of the shared subscription. */
export type LiveSubscription = Unsubscribe & { readonly id: string };

export interface ActiveSubscription {
  id: string;
  params: unknown;
}

export interface StreamManagerOptions {
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  headers: Pick<HeaderProvider, "liveHeaders">;
  liveUrl: string;
  now: () => number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  visibility?: () => DocumentVisibilityState;
  onVisibilityChange?: (callback: () => void) => () => void;
  logger?: Pick<Console, "warn" | "error">;
  /** Source of jitter for the backoff; `Math.random` by default. */
  random?: () => number;
  /** Called once per `result` frame, before its listeners (optimistic overlays use it). */
  onResult?: (id: string, rev: number) => void;
  /** Sees every error envelope of the host; `true` when the page is leaving because of it: the stream stops. */
  onError?: (error: ApiError) => boolean;
}

export interface StreamManager {
  subscribe(op: string, params: unknown, listener: SubListener): LiveSubscription;
  /** Active subscriptions of `op`, any params. */
  subscriptions(op: string): ActiveSubscription[];
  /** Reopens the stream now, skipping any backoff; no-op without subscriptions, hidden or closed. */
  reconnect(): void;
  status(): StreamStatus;
  onStatus(callback: (status: StreamStatus) => void): () => void;
  close(): void;
}

export const RESUBSCRIBE_DEBOUNCE_MS = 150;
export const WATCHDOG_MS = 45000;
export const HIDDEN_CLOSE_MS = 60000;

interface Connection {
  controller: AbortController;
  query: string;
}

function parseJson(data: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(data);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

export function createStreamManager(opts: StreamManagerOptions): StreamManager {
  const logger = opts.logger ?? console;
  const random = opts.random ?? Math.random;
  const registry = createSubscriptionRegistry((err) => logger.error("live: a subscription listener failed", err));
  const statusListeners = new Set<(status: StreamStatus) => void>();
  let current: Connection | undefined;
  let state: StreamStatus = "idle";
  let retryMs = DEFAULT_RETRY_MS;
  let attempt = 0;
  let lastActivity = 0;
  let warnedQuery = "";
  let paused = false;
  let closed = false;
  let left = false;
  let debounceTimer: unknown;
  let backoffTimer: unknown;
  let watchdogTimer: unknown;
  let hiddenTimer: unknown;

  function clear(timer: unknown): undefined {
    if (timer !== undefined) opts.clearTimeout(timer);
    return undefined;
  }

  function setStatus(next: StreamStatus): void {
    if (next === state) return;
    state = next;
    for (const cb of [...statusListeners]) {
      try {
        cb(next);
      } catch (err) {
        logger.error("live: a status listener failed", err);
      }
    }
    registry.broadcast({ type: "status", status: next });
  }

  function disconnect(): void {
    watchdogTimer = clear(watchdogTimer);
    const conn = current;
    current = undefined;
    conn?.controller.abort();
  }

  function scheduleReconnect(): void {
    if (closed || paused) return;
    if (registry.active().length === 0) {
      setStatus("idle");
      return;
    }
    setStatus("reconnecting");
    backoffTimer = clear(backoffTimer);
    backoffTimer = opts.setTimeout(() => {
      backoffTimer = undefined;
      connect();
    }, backoffDelay(attempt++, retryMs, random));
  }

  function fail(conn: Connection, error?: ApiError): void {
    if (conn !== current) return;
    disconnect();
    if (error) registry.broadcast({ type: "error", error });
    if (error && leaving(error)) return;
    scheduleReconnect();
  }

  /** Whether the page leaves because of `error`; then the stream stops for good. */
  function leaving(error: ApiError): boolean {
    if (!opts.onError) return false;
    let leaves = false;
    try {
      leaves = opts.onError(error);
    } catch (err) {
      logger.error("live: the error hook failed", err);
    }
    if (!leaves) return false;
    left = true;
    debounceTimer = clear(debounceTimer);
    backoffTimer = clear(backoffTimer);
    disconnect();
    setStatus("closed");
    return true;
  }

  function checkWatchdog(): void {
    watchdogTimer = undefined;
    if (!current) return;
    const idle = opts.now() - lastActivity;
    if (idle >= WATCHDOG_MS) {
      logger.warn(`live: no frame for ${WATCHDOG_MS / 1000} s, reconnecting`);
      fail(current);
    } else {
      watchdogTimer = opts.setTimeout(checkWatchdog, WATCHDOG_MS - idle);
    }
  }

  function onEvent(conn: Connection, event: string, data: string): void {
    if (event === "heartbeat") return;
    if (event === "bye") {
      fail(conn);
      return;
    }
    if (event !== "hello" && event !== "result" && event !== "error") return;
    const payload = parseJson(data);
    if (!payload || (event === "result" && typeof payload.rev !== "number")) {
      logger.error(`live: malformed "${event}" frame`, data);
      return;
    }
    if (event === "hello") {
      attempt = 0;
      setStatus("live");
      return;
    }
    const id = typeof payload.id === "string" ? payload.id : undefined;
    if (event === "result") {
      if (!id) return;
      const rev = payload.rev as number;
      if (opts.onResult) {
        try {
          opts.onResult(id, rev);
        } catch (err) {
          logger.error("live: the result hook failed", err);
        }
      }
      registry.emitTo(id, { type: "result", data: payload.data, rev });
      return;
    }
    const error = parseErrorEnvelope(LIVE_ERROR_STATUS, payload);
    if (payload.id === undefined) registry.broadcast({ type: "error", error });
    else if (id) registry.emitTo(id, { type: "error", error });
    leaving(error);
  }

  function onFrame(conn: Connection, frame: SseFrame): void {
    if (conn !== current) return;
    if (frame.type === "retry") {
      if (frame.ms > 0) retryMs = frame.ms;
      return;
    }
    onEvent(conn, frame.event, frame.data);
  }

  async function run(conn: Connection, url: string): Promise<void> {
    try {
      const res = await opts.fetchImpl(url, {
        method: "GET",
        headers: opts.headers.liveHeaders(),
        signal: conn.controller.signal,
        cache: "no-store",
        credentials: "same-origin",
      });
      if (conn !== current) return;
      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => undefined);
        fail(conn, parseErrorEnvelope(res.status, body));
        return;
      }
      const parser = createSseParser((frame) => onFrame(conn, frame));
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (conn !== current) return;
        if (done) break;
        lastActivity = opts.now();
        parser.push(value);
      }
      parser.flush();
      fail(conn);
    } catch (err) {
      if (conn !== current) return;
      logger.warn("live: connection lost", err);
      fail(conn);
    }
  }

  function connect(): void {
    disconnect();
    if (left) return;
    const list = registry.active();
    if (list.length === 0) {
      setStatus("idle");
      return;
    }
    const query = encodeSubscriptions(list);
    if (query !== warnedQuery) {
      warnedQuery = query;
      for (const warning of limitWarnings(list.length, query)) logger.warn(warning);
    }
    const conn: Connection = { controller: new AbortController(), query };
    current = conn;
    setStatus(state === "reconnecting" ? "reconnecting" : "connecting");
    lastActivity = opts.now();
    watchdogTimer = opts.setTimeout(checkWatchdog, WATCHDOG_MS);
    const separator = opts.liveUrl.includes("?") ? "&" : "?";
    void run(conn, `${opts.liveUrl}${separator}s=${query}`);
  }

  function sync(): void {
    debounceTimer = undefined;
    registry.prune();
    if (paused) return;
    const list = registry.active();
    if (list.length === 0) {
      backoffTimer = clear(backoffTimer);
      disconnect();
      setStatus("idle");
      return;
    }
    if (backoffTimer !== undefined) return;
    if (current && current.query === encodeSubscriptions(list)) return;
    connect();
  }

  function scheduleSync(): void {
    debounceTimer = clear(debounceTimer);
    debounceTimer = opts.setTimeout(sync, RESUBSCRIBE_DEBOUNCE_MS);
  }

  function pause(): void {
    hiddenTimer = undefined;
    paused = true;
    backoffTimer = clear(backoffTimer);
    disconnect();
    setStatus("idle");
  }

  function onVisibility(): void {
    if (closed || !opts.visibility) return;
    if (opts.visibility() === "hidden") {
      if (!paused && hiddenTimer === undefined) hiddenTimer = opts.setTimeout(pause, HIDDEN_CLOSE_MS);
      return;
    }
    hiddenTimer = clear(hiddenTimer);
    if (!paused) return;
    paused = false;
    attempt = 0;
    connect();
  }

  const stopVisibility = opts.onVisibilityChange?.(onVisibility);
  onVisibility();

  return {
    subscribe(op, params, listener) {
      if (closed) throw new Error("live: the stream manager is closed");
      const handle = registry.add(op, params, listener);
      if (handle.added) scheduleSync();
      const unsubscribe = () => {
        if (!closed && handle.remove()) scheduleSync();
      };
      return Object.assign(unsubscribe, { id: handle.id });
    },
    subscriptions(op) {
      return registry.active().flatMap((sub) => (sub.op === op ? [{ id: sub.id, params: sub.params }] : []));
    },
    reconnect() {
      if (closed || paused || registry.active().length === 0) return;
      backoffTimer = clear(backoffTimer);
      attempt = 0;
      connect();
    },
    status: () => state,
    onStatus(callback) {
      statusListeners.add(callback);
      return () => void statusListeners.delete(callback);
    },
    close() {
      if (closed) return;
      debounceTimer = clear(debounceTimer);
      backoffTimer = clear(backoffTimer);
      hiddenTimer = clear(hiddenTimer);
      disconnect();
      stopVisibility?.();
      setStatus("closed");
      closed = true;
      statusListeners.clear();
      registry.clear();
    },
  };
}
