import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./errors";
import { createSubscriptionRegistry, type SubEvent } from "./subscription-registry";

function recorder() {
  const events: SubEvent[] = [];
  return { events, fn: (e: SubEvent) => void events.push(e) };
}

const ok = (data: unknown, rev = 1): SubEvent => ({ type: "result", data, rev });

describe("createSubscriptionRegistry", () => {
  it("creates one subscription per op and stable params", () => {
    const reg = createSubscriptionRegistry(vi.fn());
    expect(reg.add("demo.item.list", { b: 1, a: 2 }, () => {}).added).toBe(true);
    expect(reg.add("demo.item.list", { a: 2, b: 1 }, () => {}).added).toBe(false);
    expect(reg.add("demo.item.stats", undefined, () => {}).added).toBe(true);
    expect(reg.active()).toEqual([
      { id: expect.stringMatching(/^[0-9a-f]{8}$/), op: "demo.item.list", params: { a: 2, b: 1 } },
      { id: expect.stringMatching(/^[0-9a-f]{8}$/), op: "demo.item.stats", params: {} },
    ]);
  });

  it("gives each handle the id of its shared subscription", () => {
    const reg = createSubscriptionRegistry(vi.fn());
    const a = reg.add("demo.item.list", { a: 1 }, () => {});
    const b = reg.add("demo.item.list", { a: 1 }, () => {});
    const other = reg.add("demo.item.list", { a: 2 }, () => {});
    expect(a.id).toBe(reg.active()[0].id);
    expect(b.id).toBe(a.id);
    expect(other.id).not.toBe(a.id);
  });

  it("routes events by id to every listener of that subscription", () => {
    const reg = createSubscriptionRegistry(vi.fn());
    const a = recorder();
    const b = recorder();
    const other = recorder();
    reg.add("demo.item.list", {}, a.fn);
    reg.add("demo.item.list", {}, b.fn);
    reg.add("demo.item.stats", {}, other.fn);
    const [list] = reg.active();
    expect(reg.emitTo(list.id, ok(["x"]))).toBe(true);
    expect(reg.emitTo("unknown", ok(["y"]))).toBe(false);
    expect(a.events).toEqual([ok(["x"])]);
    expect(b.events).toEqual([ok(["x"])]);
    expect(other.events).toEqual([]);
  });

  it("replays the last result or error, but not statuses, to a new listener", () => {
    const reg = createSubscriptionRegistry(vi.fn());
    reg.add("demo.item.list", {}, () => {});
    const [list] = reg.active();
    reg.emitTo(list.id, ok(["x"], 4));
    reg.broadcast({ type: "status", status: "live" });
    const late = recorder();
    reg.add("demo.item.list", {}, late.fn);
    expect(late.events).toEqual([ok(["x"], 4)]);

    const error: SubEvent = { type: "error", error: new ApiError(0, "app_inactive", "Off") };
    reg.emitTo(list.id, error);
    const later = recorder();
    reg.add("demo.item.list", {}, later.fn);
    expect(later.events).toEqual([error]);
  });

  it("reports when the last listener leaves, once, and keeps the entry until pruned", () => {
    const reg = createSubscriptionRegistry(vi.fn());
    const first = reg.add("demo.item.list", {}, () => {});
    const second = reg.add("demo.item.list", {}, () => {});
    expect(first.remove()).toBe(false);
    expect(first.remove()).toBe(false);
    expect(second.remove()).toBe(true);
    expect(second.remove()).toBe(false);
    expect(reg.active()).toEqual([]);
    expect(reg.add("demo.item.list", {}, () => {}).added).toBe(true);
  });

  it("keeps the cached result for a listener that comes back before pruning", () => {
    const reg = createSubscriptionRegistry(vi.fn());
    const first = reg.add("demo.item.list", {}, () => {});
    reg.emitTo(reg.active()[0].id, ok(["kept"]));
    first.remove();
    const back = recorder();
    reg.add("demo.item.list", {}, back.fn);
    expect(back.events).toEqual([ok(["kept"])]);
  });

  it("forgets empty subscriptions on prune", () => {
    const reg = createSubscriptionRegistry(vi.fn());
    const handle = reg.add("demo.item.list", {}, () => {});
    const id = reg.active()[0].id;
    reg.emitTo(id, ok(["gone"]));
    handle.remove();
    reg.prune();
    expect(reg.emitTo(id, ok(["late"]))).toBe(false);
    const fresh = recorder();
    reg.add("demo.item.list", {}, fresh.fn);
    expect(fresh.events).toEqual([]);
  });

  it("broadcasts to every subscription", () => {
    const reg = createSubscriptionRegistry(vi.fn());
    const a = recorder();
    const b = recorder();
    reg.add("demo.item.list", {}, a.fn);
    reg.add("demo.item.stats", {}, b.fn);
    reg.broadcast({ type: "status", status: "reconnecting" });
    expect(a.events).toEqual([{ type: "status", status: "reconnecting" }]);
    expect(b.events).toEqual([{ type: "status", status: "reconnecting" }]);
  });

  it("isolates a failing listener and reports its error", () => {
    const onListenerError = vi.fn();
    const reg = createSubscriptionRegistry(onListenerError);
    const good = recorder();
    reg.add("demo.item.list", {}, () => {
      throw new Error("boom");
    });
    reg.add("demo.item.list", {}, good.fn);
    reg.emitTo(reg.active()[0].id, ok(["x"]));
    expect(good.events).toEqual([ok(["x"])]);
    expect(onListenerError).toHaveBeenCalledWith(expect.any(Error));
  });

  it("drops everything on clear", () => {
    const reg = createSubscriptionRegistry(vi.fn());
    const a = recorder();
    reg.add("demo.item.list", {}, a.fn);
    const id = reg.active()[0].id;
    reg.clear();
    expect(reg.active()).toEqual([]);
    expect(reg.emitTo(id, ok(["x"]))).toBe(false);
    expect(a.events).toEqual([]);
  });
});
