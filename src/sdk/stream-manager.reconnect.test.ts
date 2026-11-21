import { describe, expect, it } from "vitest";
import { settle, setup, recorder, HELLO, BYE, HEARTBEAT, result, keepAlive, goLive } from "./__tests__/stream-manager-harness";

describe("createStreamManager: reconnection", () => {
  it("on bye goes reconnecting and waits the server retry before reopening", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", {}, () => {});
    const call = await goLive(h);
    call.push("retry: 5000\n\n");
    call.push(BYE);
    await settle();
    expect(h.manager.status()).toBe("reconnecting");
    expect(call.aborted()).toBe(true);
    await h.clock.advance(4999);
    expect(h.net.calls).toHaveLength(1);
    await h.clock.advance(1);
    expect(h.net.calls).toHaveLength(2);
    expect(h.net.calls[1].subs).toEqual(call.subs);
    expect(h.manager.status()).toBe("reconnecting");
  });

  it("doubles the delay after each failed attempt, capped at 30 s", async () => {
    const h = setup();
    for (let i = 0; i < 7; i++) h.net.queue.push({ kind: "reject", error: new TypeError("Failed to fetch") });
    h.manager.subscribe("demo.item.list", {}, () => {});
    await h.clock.advance(150);
    expect(h.net.calls).toHaveLength(1);
    expect(h.manager.status()).toBe("reconnecting");
    let calls = 1;
    for (const delay of [3000, 6000, 12000, 24000, 30000, 30000]) {
      await h.clock.advance(delay - 1);
      expect(h.net.calls).toHaveLength(calls);
      await h.clock.advance(1);
      expect(h.net.calls).toHaveLength(++calls);
    }
  });

  it("applies jitter to the reconnection delay", async () => {
    const h = setup({ random: () => 0.5 });
    h.net.queue.push({ kind: "reject", error: new TypeError("Failed to fetch") });
    h.manager.subscribe("demo.item.list", {}, () => {});
    await h.clock.advance(150);
    await h.clock.advance(2699);
    expect(h.net.calls).toHaveLength(1);
    await h.clock.advance(1);
    expect(h.net.calls).toHaveLength(2);
  });

  it("resets the backoff once the stream says hello", async () => {
    const h = setup();
    h.net.queue.push({ kind: "reject", error: new TypeError("Failed to fetch") });
    h.manager.subscribe("demo.item.list", {}, () => {});
    await h.clock.advance(150 + 3000);
    const call = h.net.calls[1];
    call.push(HELLO + BYE);
    await settle();
    await h.clock.advance(2999);
    expect(h.net.calls).toHaveLength(2);
    await h.clock.advance(1);
    expect(h.net.calls).toHaveLength(3);
  });

  it("reconnects when the stream ends without bye", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", {}, () => {});
    const call = await goLive(h);
    call.end();
    await settle();
    expect(h.manager.status()).toBe("reconnecting");
    await h.clock.advance(3000);
    expect(h.net.calls).toHaveLength(2);
  });

  it("reconnects when no frame arrives for 45 s, heartbeats keep it alive", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", {}, () => {});
    const call = await goLive(h);
    await h.clock.advance(30000);
    call.push(HEARTBEAT);
    await h.clock.advance(44999);
    expect(h.manager.status()).toBe("live");
    expect(call.aborted()).toBe(false);
    await h.clock.advance(1);
    expect(h.manager.status()).toBe("reconnecting");
    expect(call.aborted()).toBe(true);
    expect(h.logger.warn).toHaveBeenCalled();
    await h.clock.advance(3000);
    expect(h.net.calls).toHaveLength(2);
  });

  it("repopulates every subscription after reconnecting", async () => {
    const h = setup();
    const rec = recorder();
    h.manager.subscribe("demo.item.list", {}, rec.fn);
    const first = await goLive(h);
    first.push(result(first.subs[0].id, ["v1"], 1) + BYE);
    await h.clock.advance(3000);
    const second = h.net.calls[1];
    second.push(HELLO + result(second.subs[0].id, ["v2"], 2));
    await settle();
    expect(h.manager.status()).toBe("live");
    expect(rec.results().map((e) => e.type === "result" && e.data)).toEqual([["v1"], ["v2"]]);
    expect(h.statuses).toEqual(["connecting", "live", "reconnecting", "live"]);
  });

  it("picks up subscription changes made while waiting to reconnect", async () => {
    const h = setup();
    h.manager.subscribe("demo.item.list", {}, () => {});
    const call = await goLive(h);
    call.push(BYE);
    await settle();
    h.manager.subscribe("demo.item.stats", {}, () => {});
    await h.clock.advance(3000);
    expect(h.net.calls).toHaveLength(2);
    expect(h.net.calls[1].subs.map((s) => s.op)).toEqual(["demo.item.list", "demo.item.stats"]);
  });
});

describe("createStreamManager: visibility", () => {
  function visible() {
    let state: DocumentVisibilityState = "visible";
    let listener: (() => void) | undefined;
    return {
      set(next: DocumentVisibilityState) {
        state = next;
        listener?.();
      },
      registered: () => listener !== undefined,
      options: {
        visibility: () => state,
        onVisibilityChange: (cb: () => void) => {
          listener = cb;
          return () => void (listener = undefined);
        },
      },
    };
  }

  it("closes the stream after 60 s hidden and reopens at once when visible again", async () => {
    const page = visible();
    const h = setup(page.options);
    h.manager.subscribe("demo.item.list", {}, () => {});
    const call = await goLive(h);
    page.set("hidden");
    await keepAlive(h, call, 3);
    await h.clock.advance(14999);
    expect(call.aborted()).toBe(false);
    await h.clock.advance(1);
    expect(call.aborted()).toBe(true);
    expect(h.manager.status()).toBe("idle");
    await h.clock.advance(120000);
    expect(h.net.calls).toHaveLength(1);
    page.set("visible");
    await settle();
    expect(h.net.calls).toHaveLength(2);
    expect(h.manager.status()).toBe("connecting");
  });

  it("keeps the stream when the page is hidden for less than 60 s", async () => {
    const page = visible();
    const h = setup(page.options);
    h.manager.subscribe("demo.item.list", {}, () => {});
    const call = await goLive(h);
    page.set("hidden");
    await keepAlive(h, call, 2);
    page.set("visible");
    await keepAlive(h, call, 6);
    expect(call.aborted()).toBe(false);
    expect(h.manager.status()).toBe("live");
    expect(h.net.calls).toHaveLength(1);
  });
});
