/**
 * What the stream manager and its connection share: the options, the subscriptions, the open connection, the
 * status and the pending timers, with the steps both sides take on them (a status change, cancelling a timer,
 * dropping the connection).
 */
import { DEFAULT_RETRY_MS } from "./backoff";
import type { ApiError } from "./errors";
import type { HeaderProvider } from "./headers";
import { createSubscriptionRegistry, type StreamStatus, type SubscriptionRegistry } from "./subscription-registry";

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

export interface Connection {
  controller: AbortController;
  query: string;
}

export type TimerName = "debounce" | "backoff" | "watchdog" | "hidden";

export interface StreamState {
  readonly opts: StreamManagerOptions;
  readonly logger: Pick<Console, "warn" | "error">;
  readonly random: () => number;
  readonly registry: SubscriptionRegistry;
  readonly statusListeners: Set<(status: StreamStatus) => void>;
  readonly timers: Record<TimerName, unknown>;
  current: Connection | undefined;
  status: StreamStatus;
  retryMs: number;
  attempt: number;
  lastActivity: number;
  warnedQuery: string;
  paused: boolean;
  closed: boolean;
  /** The page left because of an error of the host: the stream never opens again. */
  left: boolean;
}

export function createStreamState(opts: StreamManagerOptions): StreamState {
  const logger = opts.logger ?? console;
  return {
    opts,
    logger,
    random: opts.random ?? Math.random,
    registry: createSubscriptionRegistry((err) => logger.error("live: a subscription listener failed", err)),
    statusListeners: new Set(),
    timers: { debounce: undefined, backoff: undefined, watchdog: undefined, hidden: undefined },
    current: undefined,
    status: "idle",
    retryMs: DEFAULT_RETRY_MS,
    attempt: 0,
    lastActivity: 0,
    warnedQuery: "",
    paused: false,
    closed: false,
    left: false,
  };
}

export function cancel(s: StreamState, timer: TimerName): void {
  if (s.timers[timer] !== undefined) s.opts.clearTimeout(s.timers[timer]);
  s.timers[timer] = undefined;
}

export function setStatus(s: StreamState, next: StreamStatus): void {
  if (next === s.status) return;
  s.status = next;
  for (const cb of [...s.statusListeners]) {
    try {
      cb(next);
    } catch (err) {
      s.logger.error("live: a status listener failed", err);
    }
  }
  s.registry.broadcast({ type: "status", status: next });
}

export function disconnect(s: StreamState): void {
  cancel(s, "watchdog");
  const conn = s.current;
  s.current = undefined;
  conn?.controller.abort();
}
