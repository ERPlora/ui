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
import { connect } from "./stream-connection";
import { cancel, createStreamState, disconnect, setStatus, type StreamManagerOptions, type StreamState } from "./stream-state";
import type { StreamStatus, SubListener } from "./subscription-registry";
import { encodeSubscriptions } from "./subscriptions";

export type { StreamStatus, SubEvent, SubListener } from "./subscription-registry";
export type Unsubscribe = () => void;

/** Unsubscribe function that also carries the wire id of the shared subscription. */
export type LiveSubscription = Unsubscribe & { readonly id: string };

export interface ActiveSubscription {
  id: string;
  params: unknown;
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
export const HIDDEN_CLOSE_MS = 60000;

function sync(s: StreamState): void {
  s.timers.debounce = undefined;
  s.registry.prune();
  if (s.paused) return;
  const list = s.registry.active();
  if (list.length === 0) {
    cancel(s, "backoff");
    disconnect(s);
    setStatus(s, "idle");
    return;
  }
  if (s.timers.backoff !== undefined) return;
  if (s.current && s.current.query === encodeSubscriptions(list)) return;
  connect(s);
}

function scheduleSync(s: StreamState): void {
  cancel(s, "debounce");
  s.timers.debounce = s.opts.setTimeout(() => sync(s), RESUBSCRIBE_DEBOUNCE_MS);
}

function pause(s: StreamState): void {
  s.timers.hidden = undefined;
  s.paused = true;
  cancel(s, "backoff");
  disconnect(s);
  setStatus(s, "idle");
}

function onVisibility(s: StreamState): void {
  if (s.closed || !s.opts.visibility) return;
  if (s.opts.visibility() === "hidden") {
    if (!s.paused && s.timers.hidden === undefined) s.timers.hidden = s.opts.setTimeout(() => pause(s), HIDDEN_CLOSE_MS);
    return;
  }
  cancel(s, "hidden");
  if (!s.paused) return;
  s.paused = false;
  s.attempt = 0;
  connect(s);
}

function reconnect(s: StreamState): void {
  if (s.closed || s.paused || s.registry.active().length === 0) return;
  cancel(s, "backoff");
  s.attempt = 0;
  connect(s);
}

function close(s: StreamState, stopVisibility: (() => void) | undefined): void {
  if (s.closed) return;
  cancel(s, "debounce");
  cancel(s, "backoff");
  cancel(s, "hidden");
  disconnect(s);
  stopVisibility?.();
  setStatus(s, "closed");
  s.closed = true;
  s.statusListeners.clear();
  s.registry.clear();
}

export function createStreamManager(opts: StreamManagerOptions): StreamManager {
  const s = createStreamState(opts);
  const stopVisibility = opts.onVisibilityChange?.(() => onVisibility(s));
  onVisibility(s);

  return {
    subscribe(op, params, listener) {
      if (s.closed) throw new Error("live: the stream manager is closed");
      const handle = s.registry.add(op, params, listener);
      if (handle.added) scheduleSync(s);
      const unsubscribe = () => {
        if (!s.closed && handle.remove()) scheduleSync(s);
      };
      return Object.assign(unsubscribe, { id: handle.id });
    },
    subscriptions(op) {
      return s.registry.active().flatMap((sub) => (sub.op === op ? [{ id: sub.id, params: sub.params }] : []));
    },
    reconnect: () => reconnect(s),
    status: () => s.status,
    onStatus(callback) {
      s.statusListeners.add(callback);
      return () => void s.statusListeners.delete(callback);
    },
    close: () => close(s, stopVisibility),
  };
}
