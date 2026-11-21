import { describe, expect, it, vi } from "vitest";
import { DEFAULT_RETRY_MS } from "./backoff";
import { fakeOptions, recorder } from "./__tests__/stream-manager-harness";
import { cancel, createStreamState, disconnect, setStatus } from "./stream-state";

describe("createStreamState", () => {
  it("starts idle with the default retry, no connection and no timers", () => {
    const s = createStreamState(fakeOptions().options);
    expect(s.status).toBe("idle");
    expect(s.retryMs).toBe(DEFAULT_RETRY_MS);
    expect(s.current).toBeUndefined();
    expect(s.timers).toEqual({ debounce: undefined, backoff: undefined, watchdog: undefined, hidden: undefined });
    expect([s.attempt, s.lastActivity, s.warnedQuery]).toEqual([0, 0, ""]);
    expect([s.paused, s.closed, s.left]).toEqual([false, false, false]);
  });

  it("falls back to the console and Math.random when no logger or jitter source is given", () => {
    const { options } = fakeOptions();
    const s = createStreamState({ ...options, logger: undefined, random: undefined });
    expect(s.logger).toBe(console);
    expect(s.random).toBe(Math.random);
  });

  it("logs a subscription listener that throws", () => {
    const h = fakeOptions();
    const s = createStreamState(h.options);
    s.registry.add("demo.item.list", {}, () => {
      throw new Error("boom");
    });
    setStatus(s, "connecting");
    expect(h.logger.error).toHaveBeenCalledWith("live: a subscription listener failed", expect.any(Error));
  });
});

describe("setStatus", () => {
  it("tells status listeners and subscriptions once per change", () => {
    const s = createStreamState(fakeOptions().options);
    const rec = recorder();
    const seen: string[] = [];
    s.registry.add("demo.item.list", {}, rec.fn);
    s.statusListeners.add((status) => seen.push(status));
    setStatus(s, "connecting");
    setStatus(s, "connecting");
    setStatus(s, "live");
    expect(s.status).toBe("live");
    expect(seen).toEqual(["connecting", "live"]);
    expect(rec.events).toEqual([
      { type: "status", status: "connecting" },
      { type: "status", status: "live" },
    ]);
  });

  it("keeps telling the other listeners when one throws, and logs it", () => {
    const h = fakeOptions();
    const s = createStreamState(h.options);
    const seen: string[] = [];
    s.statusListeners.add(() => {
      throw new Error("boom");
    });
    s.statusListeners.add((status) => seen.push(status));
    setStatus(s, "live");
    expect(seen).toEqual(["live"]);
    expect(h.logger.error).toHaveBeenCalledWith("live: a status listener failed", expect.any(Error));
  });
});

describe("cancel", () => {
  it("clears a pending timer and forgets its handle", async () => {
    const h = fakeOptions();
    const s = createStreamState(h.options);
    const fired = vi.fn();
    s.timers.backoff = h.clock.setTimeout(fired, 10);
    cancel(s, "backoff");
    expect(s.timers.backoff).toBeUndefined();
    await h.clock.advance(10);
    expect(fired).not.toHaveBeenCalled();
  });

  it("does not call clearTimeout when there is no timer", () => {
    const clearTimeout = vi.fn();
    const s = createStreamState(fakeOptions({ clearTimeout }).options);
    cancel(s, "hidden");
    expect(clearTimeout).not.toHaveBeenCalled();
  });
});

describe("disconnect", () => {
  it("aborts the open connection, forgets it and stops its watchdog", async () => {
    const h = fakeOptions();
    const s = createStreamState(h.options);
    const controller = new AbortController();
    const watchdog = vi.fn();
    s.current = { controller, query: "q" };
    s.timers.watchdog = h.clock.setTimeout(watchdog, 10);
    disconnect(s);
    expect(controller.signal.aborted).toBe(true);
    expect(s.current).toBeUndefined();
    expect(s.timers.watchdog).toBeUndefined();
    await h.clock.advance(10);
    expect(watchdog).not.toHaveBeenCalled();
  });

  it("does nothing without a connection", () => {
    const s = createStreamState(fakeOptions().options);
    disconnect(s);
    expect(s.current).toBeUndefined();
  });
});
