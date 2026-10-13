import { describe, expect, it, vi } from "vitest";
import { ApiError, isUnauthorized } from "./errors";
import {
  createStreamManager,
  type StreamManagerOptions,
  type StreamStatus,
  type SubEvent,
} from "./stream-manager";

// ---------------------------------------------------------------- harness

const enc = new TextEncoder();
const LIVE_HEADERS = { Accept: "text/event-stream", "X-Device-Id": "dev-1", "X-Client-Instance": "tab-1" };

async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

class FakeClock {
  private t = 0;
  private seq = 0;
  private timers = new Map<number, { at: number; cb: () => void }>();
  now = (): number => this.t;
  setTimeout = (cb: () => void, ms: number): number => {
    this.timers.set(++this.seq, { at: this.t + ms, cb });
    return this.seq;
  };
  clearTimeout = (id: unknown): void => {
    this.timers.delete(id as number);
  };
  pending = (): number => this.timers.size;
  async advance(ms: number): Promise<void> {
    const end = this.t + ms;
    await settle();
    for (;;) {
      let next: [number, { at: number; cb: () => void }] | undefined;
      for (const entry of this.timers) {
        if (entry[1].at <= end && (!next || entry[1].at < next[1].at)) next = entry;
      }
      if (!next) break;
      this.timers.delete(next[0]);
      this.t = next[1].at;
      next[1].cb();
      await settle();
    }
    this.t = end;
  }
}

interface WireSub {
  id: string;
  op: string;
  params: unknown;
}

function decodeQuery(url: string): WireSub[] {
  const s = new URL(url, "http://hub.localhost").searchParams.get("s") ?? "";
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))) as WireSub[];
}

type Behaviour =
  | { kind: "stream"; ignoreAbort?: boolean }
  | { kind: "reject"; error: Error }
  | { kind: "status"; status: number; body: string };

interface Call {
  url: string;
  init: RequestInit;
  subs: WireSub[];
  push(text: string): void;
  end(): void;
  aborted(): boolean;
}

function createFakeFetch() {
  const calls: Call[] = [];
  const queue: Behaviour[] = [];
  const fetchImpl = (url: string, init: RequestInit): Promise<Response> => {
    const behaviour = queue.shift() ?? { kind: "stream" };
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({ start: (c) => void (controller = c) });
    const signal = init.signal as AbortSignal;
    if (!(behaviour.kind === "stream" && behaviour.ignoreAbort)) {
      signal.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
    }
    calls.push({
      url,
      init,
      subs: decodeQuery(url),
      push: (text) => controller.enqueue(enc.encode(text)),
      end: () => controller.close(),
      aborted: () => signal.aborted,
    });
    if (behaviour.kind === "reject") return Promise.reject(behaviour.error);
    if (behaviour.kind === "status") return Promise.resolve(new Response(behaviour.body, { status: behaviour.status }));
    return Promise.resolve(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }));
  };
  return { calls, queue, fetchImpl };
}

function setup(overrides: Partial<StreamManagerOptions> = {}) {
  const clock = new FakeClock();
  const net = createFakeFetch();
  const logger = { warn: vi.fn(), error: vi.fn() };
  const manager = createStreamManager({
    fetchImpl: net.fetchImpl,
    headers: { liveHeaders: () => ({ ...LIVE_HEADERS }) },
    liveUrl: "/api/live",
    now: clock.now,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    logger,
    random: () => 0,
    ...overrides,
  });
  const statuses: StreamStatus[] = [];
  manager.onStatus((s) => statuses.push(s));
  return { clock, net, logger, manager, statuses };
}

function recorder() {
  const events: SubEvent[] = [];
  return {
    events,
    fn: (e: SubEvent) => void events.push(e),
    results: () => events.filter((e) => e.type === "result"),
    errors: () => events.flatMap((e) => (e.type === "error" ? [e.error] : [])),
  };
}

const HELLO = 'event: hello\ndata: {"stream":"0192-stream"}\n\n';
const BYE = "event: bye\ndata: {}\n\n";
const HEARTBEAT = "event: heartbeat\ndata: {}\n\n";
const result = (id: string, data: unknown, rev: number) =>
  `event: result\ndata: ${JSON.stringify({ id, data, rev })}\n\n`;
const errorFrame = (id: string | undefined, code: string) =>
  `event: error\ndata: ${JSON.stringify({ ...(id ? { id } : {}), error: { code, message: `msg ${code}` } })}\n\n`;
const idOf = (call: Call, op: string) => call.subs.find((s) => s.op === op)?.id ?? "missing";

/** Advances the clock in 15 s steps, sending a heartbeat after each one, as the server does. */
async function keepAlive(h: ReturnType<typeof setup>, call: Call, steps: number): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await h.clock.advance(15000);
    call.push(HEARTBEAT);
  }
}

async function goLive(h: ReturnType<typeof setup>): Promise<Call> {
  await h.clock.advance(150);
  const call = h.net.calls.at(-1) as Call;
  call.push(HELLO);
  await settle();
  return call;
}

// ---------------------------------------------------------------- tests

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
