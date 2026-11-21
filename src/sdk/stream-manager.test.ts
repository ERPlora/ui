import { describe, expect, it } from "vitest";
import { LIVE_HEADERS, settle, setup, recorder, HELLO, BYE, result, errorFrame, idOf, goLive } from "./__tests__/stream-manager-harness";

describe("createStreamManager: opening", () => {
  it("opens one stream after 150 ms with the encoded subscriptions and the live headers", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", { search: "x", limit: 20 }, () => {});
    h.manager.subscribe("demo.item.stats", undefined, () => {});
    await h.clock.advance(149);
    expect(h.net.calls).toHaveLength(0);
    expect(h.manager.status()).toBe("idle");
    await h.clock.advance(1);
    expect(h.net.calls).toHaveLength(1);
    const call = h.net.calls[0];
    expect(call.url.startsWith("/api/live?s=")).toBe(true);
    expect(call.subs).toEqual([
      { id: expect.stringMatching(/^[0-9a-f]{8}$/), op: "demo.item.list", params: { limit: 20, search: "x" } },
      { id: expect.stringMatching(/^[0-9a-f]{8}$/), op: "demo.item.stats", params: {} },
    ]);
    expect(call.init.method).toBe("GET");
    expect(call.init.headers).toEqual(LIVE_HEADERS);
    expect(call.init.signal).toBeInstanceOf(AbortSignal);
    expect(h.manager.status()).toBe("connecting");
  });

  it("goes live on hello and tells status listeners and subscribers", async () => {
    const h = setup();
    const rec = recorder();
    h.manager.subscribe("demo.item.list", {}, rec.fn);
    await goLive(h);
    expect(h.manager.status()).toBe("live");
    expect(h.statuses).toEqual(["connecting", "live"]);
    expect(rec.events).toEqual([
      { type: "status", status: "connecting" },
      { type: "status", status: "live" },
    ]);
  });

  it("appends the query to a live URL that already has parameters", async () => {
    const h = setup({ liveUrl: "/api/live?v=1" });
    h.manager.subscribe("demo.item.list", {}, () => {});
    await h.clock.advance(150);
    expect(h.net.calls[0].url).toMatch(/^\/api\/live\?v=1&s=[A-Za-z0-9_-]+$/);
  });
});

describe("createStreamManager: subscriptions", () => {
  it("routes each result by id to its own listeners only", async () => {
    const h = setup();
    const list = recorder();
    const stats = recorder();
    h.manager.subscribe("demo.item.list", {}, list.fn);
    h.manager.subscribe("demo.item.stats", {}, stats.fn);
    const call = await goLive(h);
    call.push(result(idOf(call, "demo.item.list"), [{ id: 1 }], 7));
    await settle();
    expect(list.results()).toEqual([{ type: "result", data: [{ id: 1 }], rev: 7 }]);
    expect(stats.results()).toEqual([]);
  });

  it("shares one subscription for the same op and params, whatever the key order", async () => {
    const h = setup();
    const a = recorder();
    const b = recorder();
    h.manager.subscribe("demo.item.list", { limit: 20, search: "x" }, a.fn);
    h.manager.subscribe("demo.item.list", { search: "x", limit: 20 }, b.fn);
    const call = await goLive(h);
    expect(call.subs).toHaveLength(1);
    call.push(result(call.subs[0].id, ["row"], 1));
    await settle();
    expect(a.results()).toHaveLength(1);
    expect(b.results()).toHaveLength(1);
  });

  it("replays the cached result to a late listener of a shared subscription", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", {}, () => {});
    const call = await goLive(h);
    call.push(result(call.subs[0].id, ["cached"], 3));
    await settle();
    const late = recorder();
    h.manager.subscribe("demo.item.list", {}, late.fn);
    expect(late.results()).toEqual([{ type: "result", data: ["cached"], rev: 3 }]);
    await h.clock.advance(1000);
    expect(h.net.calls).toHaveLength(1);
  });

  it("reopens exactly once, 150 ms after the last change of the subscription set", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", {}, () => {});
    const first = await goLive(h);
    h.manager.subscribe("demo.item.detail", { id: 1 }, () => {});
    await h.clock.advance(100);
    const offStats = h.manager.subscribe("demo.item.stats", {}, () => {});
    await h.clock.advance(100);
    offStats();
    await h.clock.advance(149);
    expect(h.net.calls).toHaveLength(1);
    await h.clock.advance(1);
    expect(h.net.calls).toHaveLength(2);
    expect(first.aborted()).toBe(true);
    expect(h.net.calls[1].subs.map((s) => s.op)).toEqual(["demo.item.list", "demo.item.detail"]);
    await h.clock.advance(5000);
    expect(h.net.calls).toHaveLength(2);
  });

  it("ignores frames that still arrive on a superseded connection", async () => {
    const h = setup();
    h.net.queue.push({ kind: "stream", ignoreAbort: true });
    const rec = recorder();
    h.manager.subscribe("demo.item.list", {}, rec.fn);
    const old = await goLive(h);
    h.manager.subscribe("demo.item.stats", {}, () => {});
    await h.clock.advance(150);
    expect(old.aborted()).toBe(true);
    old.push(result(old.subs[0].id, ["stale"], 99) + "retry: 60000\n\n" + HELLO);
    await settle();
    expect(rec.results()).toEqual([]);
    expect(h.manager.status()).toBe("connecting");
  });

  it("does not reopen when a change is undone within the debounce window", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", {}, () => {});
    await goLive(h);
    const off = h.manager.subscribe("demo.item.stats", {}, () => {});
    off();
    await h.clock.advance(1000);
    expect(h.net.calls).toHaveLength(1);
  });

  it("keeps the subscription while another listener still uses it", async () => {
    const h = setup();
    const offA = h.manager.subscribe("demo.item.list", {}, () => {});
    const b = recorder();
    h.manager.subscribe("demo.item.list", {}, b.fn);
    const call = await goLive(h);
    offA();
    offA();
    await h.clock.advance(1000);
    expect(h.net.calls).toHaveLength(1);
    call.push(result(call.subs[0].id, ["still"], 2));
    await settle();
    expect(b.results()).toHaveLength(1);
  });

  it("closes the stream and goes idle when the last subscription goes away", async () => {
    const h = setup();
    const off = h.manager.subscribe("demo.item.list", {}, () => {});
    const call = await goLive(h);
    off();
    await h.clock.advance(150);
    expect(call.aborted()).toBe(true);
    expect(h.manager.status()).toBe("idle");
    await h.clock.advance(60000);
    expect(h.net.calls).toHaveLength(1);
  });

  it("ignores results for unknown ids and malformed frames, logging the latter", async () => {
    const h = setup();
    const rec = recorder();
    h.manager.subscribe("demo.item.list", {}, rec.fn);
    const call = await goLive(h);
    call.push(result("deadbeef", ["x"], 1));
    call.push("event: result\ndata: {not json\n\n");
    call.push(`event: result\ndata: ${JSON.stringify({ id: call.subs[0].id, data: ["no rev"] })}\n\n`);
    await settle();
    expect(rec.results()).toEqual([]);
    expect(h.logger.error).toHaveBeenCalledTimes(2);
    expect(h.manager.status()).toBe("live");
  });

  it("keeps delivering when a listener throws, and logs it", async () => {
    const h = setup();
    const ok = recorder();
    h.manager.subscribe("demo.item.list", {}, (e) => {
      if (e.type === "result") throw new Error("boom");
    });
    h.manager.subscribe("demo.item.list", {}, ok.fn);
    const call = await goLive(h);
    call.push(result(call.subs[0].id, ["x"], 1));
    await settle();
    expect(ok.results()).toHaveLength(1);
    expect(h.logger.error).toHaveBeenCalled();
    expect(h.manager.status()).toBe("live");
  });

  it("warns above 50 subscriptions", async () => {
    const h = setup();
    for (let i = 0; i < 51; i++) h.manager.subscribe("demo.item.detail", { id: i }, () => {});
    await h.clock.advance(150);
    expect(h.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/51 subscriptions/));
  });

  it("warns when the encoded subscriptions exceed 12 KB", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", { search: "x".repeat(13 * 1024) }, () => {});
    await h.clock.advance(150);
    expect(h.logger.warn).toHaveBeenCalledWith(expect.stringMatching(/12 KB/));
  });
});

describe("createStreamManager: SDK hooks", () => {
  it("returns an unsubscribe function that carries the subscription id", async () => {
    const h = setup();
    const sub = h.manager.subscribe("demo.item.list", { search: "x" }, () => {});
    const call = await goLive(h);
    expect(typeof sub).toBe("function");
    expect(sub.id).toBe(idOf(call, "demo.item.list"));
  });

  it("lists the active subscriptions of an operation, whatever their params", () => {
    const h = setup();
    const a = h.manager.subscribe("demo.item.list", { search: "a" }, () => {});
    const b = h.manager.subscribe("demo.item.list", { search: "b" }, () => {});
    h.manager.subscribe("demo.item.stats", {}, () => {});
    expect(h.manager.subscriptions("demo.item.list")).toEqual([
      { id: a.id, params: { search: "a" } },
      { id: b.id, params: { search: "b" } },
    ]);
    a();
    expect(h.manager.subscriptions("demo.item.list")).toEqual([{ id: b.id, params: { search: "b" } }]);
    expect(h.manager.subscriptions("demo.item.detail")).toEqual([]);
  });

  it("reports each result frame once to onResult, before its listeners", async () => {
    const order: string[] = [];
    const h = setup({ onResult: (id, rev) => order.push(`tap ${id} ${rev}`) });
    const sub = h.manager.subscribe("demo.item.list", {}, (e) => e.type === "result" && order.push("one"));
    h.manager.subscribe("demo.item.list", {}, (e) => e.type === "result" && order.push("two"));
    const call = await goLive(h);
    call.push(result(sub.id, ["x"], 4) + errorFrame(sub.id, "app_inactive"));
    await settle();
    expect(order).toEqual([`tap ${sub.id} 4`, "one", "two"]);
  });

  it("reconnect() reopens the stream at once with the same subscriptions", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", {}, () => {});
    const first = await goLive(h);
    h.manager.reconnect();
    expect(first.aborted()).toBe(true);
    expect(h.net.calls).toHaveLength(2);
    expect(h.net.calls[1].subs).toEqual(first.subs);
    await h.clock.advance(1000);
    expect(h.net.calls).toHaveLength(2);
  });

  it("reconnect() skips a pending backoff and does nothing without subscriptions or once closed", async () => {
    const h = setup();
    h.manager.reconnect();
    await h.clock.advance(1000);
    expect(h.net.calls).toHaveLength(0);
    h.net.queue.push({ kind: "reject", error: new TypeError("Failed to fetch") });
    h.manager.subscribe("demo.item.list", {}, () => {});
    await h.clock.advance(150);
    expect(h.manager.status()).toBe("reconnecting");
    h.manager.reconnect();
    expect(h.net.calls).toHaveLength(2);
    h.manager.close();
    h.manager.reconnect();
    expect(h.net.calls).toHaveLength(2);
  });
});

describe("createStreamManager: close", () => {
  it("aborts the stream, reports closed once and delivers nothing afterwards", async () => {
    const h = setup();
    h.net.queue.push({ kind: "stream", ignoreAbort: true });
    const rec = recorder();
    h.manager.subscribe("demo.item.list", {}, rec.fn);
    const call = await goLive(h);
    h.manager.close();
    expect(call.aborted()).toBe(true);
    expect(h.manager.status()).toBe("closed");
    const before = rec.events.length;
    call.push(result(call.subs[0].id, ["late"], 9) + BYE);
    await h.clock.advance(120000);
    expect(rec.events.length).toBe(before);
    expect(rec.events.at(-1)).toEqual({ type: "status", status: "closed" });
    expect(h.statuses.at(-1)).toBe("closed");
    expect(h.net.calls).toHaveLength(1);
    expect(h.clock.pending()).toBe(0);
  });

  it("unregisters the visibility listener and refuses new subscriptions", () => {
    let unregistered = false;
    const h = setup({ visibility: () => "visible", onVisibilityChange: () => () => void (unregistered = true) });
    h.manager.close();
    expect(unregistered).toBe(true);
    expect(() => h.manager.subscribe("demo.item.list", {}, () => {})).toThrow(/closed/);
  });
});

describe("sdk transport guardrail", () => {
  const sources = import.meta.glob(["./**/*.ts", "!./**/*.test.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  it("never uses the browser's native SSE client", () => {
    expect(Object.keys(sources)).toContain("./stream-manager.ts");
    for (const [file, text] of Object.entries(sources)) {
      expect(text, file).not.toMatch(/\bEventSource\b/);
    }
  });
});
