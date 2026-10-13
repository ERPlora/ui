import { describe, expect, it, vi } from "vitest";
import { createOptimisticStore, SETTLE_TIMEOUT_MS } from "./optimistic";

class FakeTimers {
  private t = 0;
  private seq = 0;
  private timers = new Map<number, { at: number; cb: () => void }>();
  setTimeout = (cb: () => void, ms: number): number => {
    this.timers.set(++this.seq, { at: this.t + ms, cb });
    return this.seq;
  };
  clearTimeout = (id: unknown): void => void this.timers.delete(id as number);
  pending = (): number => this.timers.size;
  advance(ms: number): void {
    this.t += ms;
    for (const [id, timer] of [...this.timers].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at > this.t) continue;
      this.timers.delete(id);
      timer.cb();
    }
  }
}

function setup() {
  const timers = new FakeTimers();
  const logger = { error: vi.fn() };
  const store = createOptimisticStore({ setTimeout: timers.setTimeout, clearTimeout: timers.clearTimeout, logger });
  const changes: string[] = [];
  store.onChange((subId) => changes.push(subId));
  return { store, timers, logger, changes };
}

const append =
  (line: string) =>
  (current: unknown): string[] => [...((current as string[] | undefined) ?? []), line];

describe("createOptimisticStore", () => {
  it("shows an applied overlay immediately, only on its subscription", () => {
    const { store, changes } = setup();
    const server = ["a"];
    store.apply("s1", "o1", append("x"), 1);
    expect(store.view("s1", server)).toEqual(["a", "x"]);
    expect(store.view("s2", server)).toBe(server);
    expect(changes).toEqual(["s1"]);
  });

  it("gives back exactly the server data on rollback", () => {
    const { store, changes, timers } = setup();
    const server = Object.freeze(["a", "b"]);
    store.apply("s1", "o1", append("x"), 1);
    store.rollback("o1");
    expect(store.view("s1", server)).toBe(server);
    expect(server).toEqual(["a", "b"]);
    expect(changes).toEqual(["s1", "s1"]);
    expect(timers.pending()).toBe(0);
  });

  it("drops a settled overlay when a result with a newer rev arrives", () => {
    const { store, changes, timers } = setup();
    store.apply("s1", "o1", append("x"), 4);
    store.settle("o1");
    store.onResult("s1", 5);
    expect(store.view("s1", ["a", "x"])).toEqual(["a", "x"]);
    expect(changes).toEqual(["s1", "s1"]);
    expect(timers.pending()).toBe(0);
  });

  it("keeps a settled overlay on results with the same or an older rev", () => {
    const { store } = setup();
    store.apply("s1", "o1", append("x"), 4);
    store.settle("o1");
    store.onResult("s1", 4);
    store.onResult("s1", 3);
    store.onResult("other", 99);
    expect(store.view("s1", ["a"])).toEqual(["a", "x"]);
  });

  it("keeps an overlay whose command is still in flight, whatever result arrives", () => {
    const { store } = setup();
    store.apply("s1", "o1", append("x"), 4);
    store.onResult("s1", 5);
    expect(store.view("s1", ["a"])).toEqual(["a", "x"]);
    store.settle("o1");
    store.onResult("s1", 6);
    expect(store.view("s1", ["a", "x"])).toEqual(["a", "x"]);
  });

  it("composes several overlays in the order they were applied", () => {
    const { store } = setup();
    store.apply("s1", "o1", append("x"), 1);
    store.apply("s1", "o2", append("y"), 1);
    expect(store.view("s1", ["a"])).toEqual(["a", "x", "y"]);
    store.rollback("o1");
    expect(store.view("s1", ["a"])).toEqual(["a", "y"]);
  });

  it("drops a settled overlay after the timeout when no newer result arrives", () => {
    const { store, timers, changes } = setup();
    store.apply("s1", "o1", append("x"), 4);
    store.settle("o1");
    timers.advance(SETTLE_TIMEOUT_MS - 1);
    expect(store.view("s1", ["a"])).toEqual(["a", "x"]);
    timers.advance(1);
    expect(store.view("s1", ["a"])).toEqual(["a"]);
    expect(changes).toEqual(["s1", "s1"]);
    expect(SETTLE_TIMEOUT_MS).toBe(3000);
  });

  it("applies one overlay id to several subscriptions and removes it from all of them", () => {
    const { store, changes } = setup();
    store.apply("list", "o1", append("x"), 1);
    store.apply("detail", "o1", append("x"), 7);
    store.rollback("o1");
    expect(store.view("list", ["a"])).toEqual(["a"]);
    expect(store.view("detail", ["a"])).toEqual(["a"]);
    expect(changes).toEqual(["list", "detail", "list", "detail"]);
  });

  it("defaults the pending rev to the latest result seen for that subscription", () => {
    const { store } = setup();
    store.onResult("s1", 7);
    store.apply("s1", "o1", append("x"));
    store.settle("o1");
    store.onResult("s1", 7);
    expect(store.view("s1", ["a"])).toEqual(["a", "x"]);
    store.onResult("s1", 8);
    expect(store.view("s1", ["a"])).toEqual(["a"]);

    store.apply("fresh", "o2", append("y"));
    store.settle("o2");
    store.onResult("fresh", 0);
    expect(store.view("fresh", ["a"])).toEqual(["a"]);
  });

  it("treats any later result as newer once the server revisions restart (new stream)", () => {
    const { store } = setup();
    store.onResult("s1", 9);
    store.apply("s1", "o1", append("x"));
    store.settle("o1");
    store.resetRevisions();
    store.onResult("s1", 1);
    expect(store.view("s1", ["a"])).toEqual(["a"]);

    store.onResult("s1", 9);
    store.resetRevisions();
    store.apply("s1", "o2", append("y"));
    store.settle("o2");
    store.onResult("s1", 1);
    expect(store.view("s1", ["a"])).toEqual(["a"]);
  });

  it("leaves the data as it was when an overlay returns undefined (no overlay for that subscription)", () => {
    const { store } = setup();
    const server = ["a"];
    store.apply("s1", "skip", () => undefined, 1);
    expect(store.view("s1", server)).toBe(server);
    store.apply("s1", "o2", append("y"), 1);
    expect(store.view("s1", server)).toEqual(["a", "y"]);
  });

  it("calls an overlay with undefined before the first result and ignores its undefined answer", () => {
    const { store } = setup();
    const skip = vi.fn((current: unknown) => (current === undefined ? undefined : ["changed"]));
    store.apply("s1", "o1", skip);
    store.apply("s1", "o2", append("y"));
    expect(store.view("s1", undefined)).toEqual(["y"]);
    expect(skip).toHaveBeenCalledWith(undefined);
    expect(store.view("s1", ["a"])).toEqual(["changed", "y"]);
  });

  it("skips and logs an overlay that throws, keeping the others", () => {
    const { store, logger } = setup();
    store.apply("s1", "bad", () => {
      throw new Error("boom");
    }, 1);
    store.apply("s1", "good", append("y"), 1);
    expect(store.view("s1", ["a"])).toEqual(["a", "y"]);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it("ignores unknown overlays and stops its timers on clear", () => {
    const { store, timers, changes } = setup();
    store.settle("nope");
    store.rollback("nope");
    expect(changes).toEqual([]);
    store.apply("s1", "o1", append("x"), 1);
    store.settle("o1");
    expect(timers.pending()).toBe(1);
    store.clear();
    expect(timers.pending()).toBe(0);
    expect(store.view("s1", ["a"])).toEqual(["a"]);
  });

  it("stops notifying a listener once it unsubscribes, and survives a listener that throws", () => {
    const { store, logger } = setup();
    const seen: string[] = [];
    const stop = store.onChange((id) => seen.push(id));
    store.onChange(() => {
      throw new Error("listener");
    });
    store.apply("s1", "o1", append("x"), 1);
    stop();
    store.rollback("o1");
    expect(seen).toEqual(["s1"]);
    expect(logger.error).toHaveBeenCalled();
  });
});
