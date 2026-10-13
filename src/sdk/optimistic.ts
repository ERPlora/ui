/**
 * Optimistic overlays over live results (framework-free).
 *
 * A command may lay an overlay — a pure `(current) => next` function — on every subscription it
 * affects, so the page shows the change at once. The server always wins:
 * - the command fails → `rollback` removes the overlay and the view is the server data again;
 * - the command succeeds → `settle`; the overlay stays until a result for that subscription
 *   arrives with a `rev` newer than the one it was applied on (that result already includes the
 *   change), or until `SETTLE_TIMEOUT_MS` if the result never comes (nothing changed for it);
 * - while the command is in flight no result removes it: those results predate its COMMIT.
 * When the live stream reopens the server revisions restart, so `resetRevisions` makes any later
 * result count as newer. Overlays must not mutate `current`; one that returns `undefined` lays
 * nothing (a query result is JSON, never `undefined`), e.g. before the subscription's first result.
 */

export const SETTLE_TIMEOUT_MS = 3000;

/** `(current) => next`; returning `undefined` leaves `current` as it was. */
export type Overlay = (current: unknown) => unknown;

export interface OptimisticStoreOptions {
  setTimeout?: (callback: () => void, ms: number) => unknown;
  clearTimeout?: (handle: unknown) => void;
  settleTimeoutMs?: number;
  logger?: Pick<Console, "error">;
}

export interface OptimisticStore {
  /** Lays `fn` on `subId`. `pendingSinceRev` defaults to the latest rev seen for that subscription. */
  apply(subId: string, overlayId: string, fn: Overlay, pendingSinceRev?: number): void;
  rollback(overlayId: string): void;
  settle(overlayId: string): void;
  /** A result frame for `subId` arrived with `rev` (once per frame). */
  onResult(subId: string, rev: number): void;
  /** The live stream reopened: its revisions start again. */
  resetRevisions(): void;
  /** The server data with the overlays of `subId` applied in order. */
  view<T>(subId: string, serverData: T): T;
  /** Called with the subscription id whenever its overlays change. */
  onChange(listener: (subId: string) => void): () => void;
  /** Drops every overlay and timer (client teardown). */
  clear(): void;
}

interface Layer {
  overlayId: string;
  fn: Overlay;
  pendingSinceRev: number;
  settled: boolean;
}

export function createOptimisticStore(opts: OptimisticStoreOptions = {}): OptimisticStore {
  const setTimer = opts.setTimeout ?? ((cb: () => void, ms: number): unknown => globalThis.setTimeout(cb, ms));
  const clearTimer =
    opts.clearTimeout ?? ((handle: unknown) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
  const timeoutMs = opts.settleTimeoutMs ?? SETTLE_TIMEOUT_MS;
  const logger = opts.logger ?? console;
  const layers = new Map<string, Layer[]>();
  const latestRev = new Map<string, number>();
  const timers = new Map<string, unknown>();
  const listeners = new Set<(subId: string) => void>();

  function notify(subId: string): void {
    for (const listener of [...listeners]) {
      try {
        listener(subId);
      } catch (err) {
        logger.error("optimistic: a change listener failed", err);
      }
    }
  }

  function stopTimer(overlayId: string): void {
    if (!timers.has(overlayId)) return;
    clearTimer(timers.get(overlayId));
    timers.delete(overlayId);
  }

  function stillUsed(overlayId: string): boolean {
    for (const list of layers.values()) if (list.some((l) => l.overlayId === overlayId)) return true;
    return false;
  }

  /** Removes the layers of `subId` matching `drop`; notifies when something went away. */
  function removeFrom(subId: string, drop: (layer: Layer) => boolean): string[] {
    const list = layers.get(subId);
    if (!list) return [];
    const kept = list.filter((l) => !drop(l));
    if (kept.length === list.length) return [];
    if (kept.length === 0) layers.delete(subId);
    else layers.set(subId, kept);
    notify(subId);
    return list.filter(drop).map((l) => l.overlayId);
  }

  function removeOverlay(overlayId: string): void {
    stopTimer(overlayId);
    for (const subId of [...layers.keys()]) removeFrom(subId, (l) => l.overlayId === overlayId);
  }

  return {
    apply(subId, overlayId, fn, pendingSinceRev) {
      const rev = pendingSinceRev ?? latestRev.get(subId) ?? Number.NEGATIVE_INFINITY;
      const list = layers.get(subId) ?? [];
      list.push({ overlayId, fn, pendingSinceRev: rev, settled: false });
      layers.set(subId, list);
      notify(subId);
    },
    rollback: removeOverlay,
    settle(overlayId) {
      let found = false;
      for (const list of layers.values()) {
        for (const layer of list) {
          if (layer.overlayId !== overlayId) continue;
          layer.settled = true;
          found = true;
        }
      }
      if (!found || timers.has(overlayId)) return;
      timers.set(
        overlayId,
        setTimer(() => {
          timers.delete(overlayId);
          removeOverlay(overlayId);
        }, timeoutMs),
      );
    },
    onResult(subId, rev) {
      latestRev.set(subId, rev);
      const dropped = removeFrom(subId, (l) => l.settled && l.pendingSinceRev < rev);
      for (const overlayId of dropped) if (!stillUsed(overlayId)) stopTimer(overlayId);
    },
    resetRevisions() {
      latestRev.clear();
      for (const list of layers.values()) for (const layer of list) layer.pendingSinceRev = Number.NEGATIVE_INFINITY;
    },
    view<T>(subId: string, serverData: T): T {
      const list = layers.get(subId);
      if (!list) return serverData;
      let current: unknown = serverData;
      for (const layer of list) {
        try {
          const next = layer.fn(current);
          if (next !== undefined) current = next;
        } catch (err) {
          logger.error(`optimistic: overlay "${layer.overlayId}" failed and was skipped`, err);
        }
      }
      return current as T;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    clear() {
      for (const overlayId of [...timers.keys()]) stopTimer(overlayId);
      layers.clear();
      latestRev.clear();
    },
  };
}
