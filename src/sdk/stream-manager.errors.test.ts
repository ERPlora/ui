import { describe, expect, it, vi } from "vitest";
import { ApiError, isUnauthorized } from "./errors";
import { settle, setup, recorder, errorFrame, idOf, goLive } from "./__tests__/stream-manager-harness";

describe("createStreamManager: errors", () => {
  it("delivers an error with id to that subscription only and keeps the stream", async () => {
    const h = setup();
    const list = recorder();
    const stats = recorder();
    h.manager.subscribe("demo.item.list", {}, list.fn);
    h.manager.subscribe("demo.item.stats", {}, stats.fn);
    const call = await goLive(h);
    call.push(errorFrame(idOf(call, "demo.item.list"), "app_inactive"));
    await settle();
    expect(list.errors()).toHaveLength(1);
    const err = list.errors()[0];
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("app_inactive");
    expect(err.message).toBe("msg app_inactive");
    expect(err.status).toBe(0);
    expect(stats.errors()).toEqual([]);
    expect(call.aborted()).toBe(false);
    expect(h.manager.status()).toBe("live");
  });

  it("delivers a stream-level error (no id) to every subscription", async () => {
    const h = setup();
    const list = recorder();
    const stats = recorder();
    h.manager.subscribe("demo.item.list", {}, list.fn);
    h.manager.subscribe("demo.item.stats", {}, stats.fn);
    const call = await goLive(h);
    call.push(errorFrame(undefined, "too_many_subscriptions"));
    await settle();
    expect(list.errors().map((e) => e.code)).toEqual(["too_many_subscriptions"]);
    expect(stats.errors().map((e) => e.code)).toEqual(["too_many_subscriptions"]);
  });

  it("turns an HTTP error response into an ApiError for every subscription, then backs off", async () => {
    const h = setup();
    h.net.queue.push({
      kind: "status",
      status: 401,
      body: '{"error":{"code":"not_authenticated","message":"Login required"}}',
    });
    const rec = recorder();
    h.manager.subscribe("demo.item.list", {}, rec.fn);
    await h.clock.advance(150);
    expect(rec.errors()).toHaveLength(1);
    expect(isUnauthorized(rec.errors()[0])).toBe(true);
    expect(h.manager.status()).toBe("reconnecting");
    await h.clock.advance(3000);
    expect(h.net.calls).toHaveLength(2);
  });
});

describe("createStreamManager: an error that makes the page leave", () => {
  const SUSPENDED = '{"error":{"code":"base.hub_suspended","message":"Suspended"}}';

  it("gives the onError hook the HTTP answer of the open; when it claims it, the stream stops", async () => {
    const onError = vi.fn(() => true);
    const h = setup({ onError });
    h.net.queue.push({ kind: "status", status: 402, body: SUSPENDED });
    const rec = recorder();
    h.manager.subscribe("demo.item.list", {}, rec.fn);
    await h.clock.advance(150);
    expect(onError).toHaveBeenCalledTimes(1);
    const [error] = onError.mock.calls[0] as unknown as [ApiError];
    expect([error.status, error.code]).toEqual([402, "base.hub_suspended"]);
    // The subscription still hears why while the page leaves.
    expect(rec.errors().map((e) => e.code)).toEqual(["base.hub_suspended"]);
    await h.clock.advance(60000);
    expect(h.net.calls).toHaveLength(1);
    expect(h.manager.status()).toBe("closed");
  });

  it("gives the hook an error frame; when it claims it, the stream is closed after delivering it", async () => {
    const onError = vi.fn(() => true);
    const h = setup({ onError });
    const rec = recorder();
    h.manager.subscribe("demo.item.list", {}, rec.fn);
    const call = await goLive(h);
    call.push(errorFrame(idOf(call, "demo.item.list"), "base.hub_gone"));
    await settle();
    expect(rec.errors().map((e) => e.code)).toEqual(["base.hub_gone"]);
    expect(call.aborted()).toBe(true);
    h.manager.subscribe("demo.item.stats", {}, () => {});
    await h.clock.advance(60000);
    expect(h.net.calls).toHaveLength(1);
  });

  it("keeps today's behaviour for an error the hook does not claim", async () => {
    const onError = vi.fn(() => false);
    const h = setup({ onError });
    h.net.queue.push({ kind: "status", status: 401, body: '{"error":{"code":"unauthorized","message":"Login"}}' });
    h.manager.subscribe("demo.item.list", {}, () => {});
    await h.clock.advance(150);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(h.manager.status()).toBe("reconnecting");
    await h.clock.advance(3000);
    expect(h.net.calls).toHaveLength(2);
  });
});
