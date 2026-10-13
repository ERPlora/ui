/**
 * Shared live subscriptions of one tab: one entry per `(op, stable params)` with a refcount of
 * listeners, the last result or error cached for late listeners, and routing by id.
 * An entry whose last listener left stays until `prune()`, so a listener that comes back within
 * the resubscribe debounce keeps its cached data and the stream is not reopened.
 */
import type { ApiError } from "./errors";
import { fnv1a, stableJson, subscriptionId, type WireSubscription } from "./subscriptions";

export type StreamStatus = "idle" | "connecting" | "live" | "reconnecting" | "closed";

export type SubEvent =
  | { type: "result"; data: unknown; rev: number }
  | { type: "error"; error: ApiError }
  | { type: "status"; status: StreamStatus };

export type SubListener = (event: SubEvent) => void;

export interface SubscriptionHandle {
  /** Wire id of the shared subscription (the `id` of its `result`/`error` frames). */
  id: string;
  /** True when this call created the entry or revived an empty one. */
  added: boolean;
  /** Removes the listener; true only when it was the last one. Idempotent. */
  remove(): boolean;
}

export interface SubscriptionRegistry {
  add(op: string, params: unknown, listener: SubListener): SubscriptionHandle;
  active(): WireSubscription[];
  prune(): void;
  emitTo(id: string, event: SubEvent): boolean;
  broadcast(event: SubEvent): void;
  clear(): void;
}

interface Entry extends WireSubscription {
  key: string;
  listeners: Set<{ fn: SubListener }>;
  last?: SubEvent;
}

export function createSubscriptionRegistry(onListenerError: (error: unknown) => void): SubscriptionRegistry {
  const byKey = new Map<string, Entry>();
  const byId = new Map<string, Entry>();

  function deliver(fn: SubListener, event: SubEvent): void {
    try {
      fn(event);
    } catch (error) {
      onListenerError(error);
    }
  }

  function emit(entry: Entry, event: SubEvent): void {
    if (event.type !== "status") entry.last = event;
    for (const listener of [...entry.listeners]) deliver(listener.fn, event);
  }

  function entryFor(op: string, params: unknown): Entry {
    const paramsJson = stableJson(params);
    const key = `${op}\u0000${paramsJson}`;
    const existing = byKey.get(key);
    if (existing) return existing;
    let id = subscriptionId(op, paramsJson);
    while (byId.has(id)) id = fnv1a(`${id}${key}`);
    const entry: Entry = { id, op, params: JSON.parse(paramsJson) as unknown, key, listeners: new Set() };
    byKey.set(key, entry);
    byId.set(id, entry);
    return entry;
  }

  return {
    add(op, params, listener) {
      const entry = entryFor(op, params);
      const added = entry.listeners.size === 0;
      const handle = { fn: listener };
      entry.listeners.add(handle);
      if (entry.last) deliver(listener, entry.last);
      return {
        id: entry.id,
        added,
        remove: () => entry.listeners.delete(handle) && entry.listeners.size === 0,
      };
    },
    active() {
      const list: WireSubscription[] = [];
      for (const entry of byKey.values()) {
        if (entry.listeners.size > 0) list.push({ id: entry.id, op: entry.op, params: entry.params });
      }
      return list;
    },
    prune() {
      for (const [key, entry] of byKey) {
        if (entry.listeners.size > 0) continue;
        byKey.delete(key);
        byId.delete(entry.id);
      }
    },
    emitTo(id, event) {
      const entry = byId.get(id);
      if (!entry) return false;
      emit(entry, event);
      return true;
    },
    broadcast(event) {
      for (const entry of [...byKey.values()]) emit(entry, event);
    },
    clear() {
      byKey.clear();
      byId.clear();
    },
  };
}
