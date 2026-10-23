/* eslint-disable vue/one-component-per-file -- provide/inject needs a parent and a child component */
import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import {
  BYE,
  createTestClient,
  errorFrame,
  flush,
  HELLO,
  memoryStorage,
  resultFrame,
  TEST_CONFIG,
  TEST_ROUTES,
} from "./__tests__/live-harness";
import { createLiveClient, LIVE_CLIENT_KEY, provideLiveClient, useLiveClient, type LiveClient } from "./live-client";

// Node ≥ 25 defines its own `localStorage` (undefined without --localstorage-file), which hides
// happy-dom's; each test gets an in-memory one instead.
beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.cookie = "hub_csrftoken=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
});

describe("createLiveClient: browser defaults", () => {
  it("uses the global fetch, localStorage and the CSRF cookie named in the config", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(Response.json({ id: "l1", text: "x" })),
    );
    vi.stubGlobal("fetch", fetchMock);
    document.cookie = "hub_csrftoken=from-cookie";
    const client = createLiveClient({ ...TEST_CONFIG, routes: TEST_ROUTES });
    await client.api.call("test.item.add_line", { id: "i1", text: "x", client_line_id: "c1" });
    const [url, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("/api/test/items/i1/lines");
    expect(headers["X-CSRFToken"]).toBe("from-cookie");
    expect(headers["X-Device-Id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(window.localStorage.getItem(TEST_CONFIG.deviceIdStorageKey)).toBe(headers["X-Device-Id"]);
    client.close();
  });

  it("opens the live stream with the browser timers and the same device id", async () => {
    vi.useFakeTimers();
    try {
      const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() => new Promise(() => {}));
      vi.stubGlobal("fetch", fetchMock);
      const client = createLiveClient(TEST_CONFIG);
      client.stream.subscribe("test.item.list", {}, () => {});
      expect(fetchMock).not.toHaveBeenCalled();
      vi.advanceTimersByTime(150);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toMatch(/^\/api\/live\?s=/);
      expect((init.headers as Record<string, string>)["X-Device-Id"]).toBe(
        window.localStorage.getItem(TEST_CONFIG.deviceIdStorageKey),
      );
      client.close();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("createLiveClient: routes", () => {
  it("prefers the routes given to the constructor over the ones in spa-config", async () => {
    const { client, net } = createTestClient(
      { routes: { "test.session.me": { method: "get", path: "/api/v2/me" } } },
      { ...TEST_CONFIG, routes: { "test.session.me": { method: "get", path: "/api/v1/me" } } },
    );
    await client.api.call("test.session.me");
    expect(net.api[0].url).toBe("/api/v2/me");
  });

  it("falls back to the routes of spa-config, and to none at all", async () => {
    const fromConfig = createTestClient(
      { routes: undefined },
      { ...TEST_CONFIG, routes: { "test.session.me": { method: "get", path: "/api/v1/me" } } },
    );
    await fromConfig.client.api.call("test.session.me");
    expect(fromConfig.net.api[0].url).toBe("/api/v1/me");
    const none = createTestClient({ routes: undefined });
    await expect(none.client.api.call("test.session.me")).rejects.toThrow(/unknown operation/);
  });
});

describe("createLiveClient: optimistic wiring", () => {
  it("drops a settled overlay when the stream delivers a newer result", async () => {
    const { client, goLive } = createTestClient();
    const sub = client.stream.subscribe("test.item.list", {}, () => {});
    const call = await goLive();
    call.push(resultFrame(sub.id, ["a"], 4));
    await flush();
    client.optimistic.apply(sub.id, "o1", (cur) => [...(cur as string[]), "x"]);
    client.optimistic.settle("o1");
    call.push(resultFrame(sub.id, ["a"], 4));
    await flush();
    expect(client.optimistic.view(sub.id, ["a"])).toEqual(["a", "x"]);
    call.push(resultFrame(sub.id, ["a", "x"], 5));
    await flush();
    expect(client.optimistic.view(sub.id, ["a", "x"])).toEqual(["a", "x"]);
  });

  it("restarts the revisions when the stream reopens", async () => {
    const { client, goLive, net } = createTestClient();
    const sub = client.stream.subscribe("test.item.list", {}, () => {});
    const first = await goLive();
    first.push(resultFrame(sub.id, ["a"], 9));
    await flush();
    client.optimistic.apply(sub.id, "o1", (cur) => [...(cur as string[]), "x"]);
    client.optimistic.settle("o1");
    client.stream.reconnect();
    const second = net.lastStream();
    expect(second).not.toBe(first);
    second.push(HELLO + resultFrame(sub.id, ["a", "x"], 1));
    await flush();
    expect(client.optimistic.view(sub.id, ["a", "x"])).toEqual(["a", "x"]);
  });
});

describe("createLiveClient: a host that no longer serves the app", () => {
  it("reloads the page once when a command hears it, and the stream stops reconnecting", async () => {
    const reload = vi.fn();
    const { client, net, goLive, clock } = createTestClient({ reload, session: memoryStorage(), wallClock: () => 1 });
    client.stream.subscribe("test.item.list", {}, () => {});
    const call = await goLive();
    net.onApi(() => Response.json({ error: { code: "base.hub_suspended", message: "Suspended" } }, { status: 402 }));

    await expect(client.api.call("test.item.add_line", { id: "i1", text: "x", client_line_id: "c1" })).rejects.toThrow(
      "Suspended",
    );
    expect(reload).toHaveBeenCalledTimes(1);

    call.push(errorFrame(call.subs[0].id, "base.hub_suspended"));
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(call.aborted()).toBe(true);
    await clock.advance(60000);
    expect(net.streams).toHaveLength(1);
    client.close();
  });

  it("reloads when the live stream hears it first", async () => {
    const reload = vi.fn();
    const { client, goLive } = createTestClient({ reload, session: memoryStorage(), wallClock: () => 1 });
    client.stream.subscribe("test.item.list", {}, () => {});
    const call = await goLive();
    call.push(errorFrame(call.subs[0].id, "base.hub_gone"));
    await flush();
    expect(reload).toHaveBeenCalledTimes(1);
    client.close();
  });

  it("leaves any other refusal to the page", async () => {
    const reload = vi.fn();
    const { client, net } = createTestClient({ reload, session: memoryStorage(), wallClock: () => 1 });
    net.onApi(() => Response.json({ error: { code: "app_inactive", message: "Off" } }, { status: 404 }));
    await expect(client.api.call("test.session.me")).rejects.toThrow("Off");
    expect(reload).not.toHaveBeenCalled();
    client.close();
  });
});

describe("createLiveClient: a session that ended", () => {
  const signedOut = () => Response.json({ error: { code: "unauthorized", message: "Sign in" } }, { status: 401 });

  it("reloads the page once when the stream of a page with a session reopens without it, and stops", async () => {
    const reload = vi.fn();
    const { client, net, goLive, clock } = createTestClient({ reload, session: memoryStorage(), wallClock: () => 1 });
    client.stream.subscribe("test.item.list", {}, () => {});
    const call = await goLive();
    net.refuseLive(signedOut);

    call.push(BYE); // the Hub ended the stream: its session was revoked
    await flush();
    await clock.advance(30000);

    expect(reload).toHaveBeenCalledTimes(1);
    expect(client.stream.status()).toBe("closed");
    const opens = net.opened.length;
    await clock.advance(120000);
    expect(net.opened).toHaveLength(opens);
    client.close();
  });

  it("reloads when a command of a page with a session hears it", async () => {
    const reload = vi.fn();
    const { client, net, goLive } = createTestClient({ reload, session: memoryStorage(), wallClock: () => 1 });
    client.stream.subscribe("test.item.list", {}, () => {});
    await goLive();
    net.onApi(signedOut);

    await expect(client.api.call("test.item.add_line", { id: "i1", text: "x", client_line_id: "c1" })).rejects.toThrow(
      "Sign in",
    );
    expect(reload).toHaveBeenCalledTimes(1);
    client.close();
  });

  it("keeps a page that never had a session as it is: no reload, the stream keeps trying", async () => {
    const reload = vi.fn();
    const { client, net, clock } = createTestClient({ reload, session: memoryStorage(), wallClock: () => 1 });
    net.refuseLive(signedOut);
    net.onApi(signedOut);
    client.stream.subscribe("test.item.list", {}, () => {});

    await clock.advance(30000);
    await expect(client.api.call("test.session.me")).rejects.toThrow("Sign in");

    expect(reload).not.toHaveBeenCalled();
    expect(net.opened.length).toBeGreaterThan(1);
    client.close();
  });

  it("does not reload again right after a reload for it", async () => {
    const reload = vi.fn();
    const session = memoryStorage();
    session.setItem("erplora.live.host-closed-reload", "1");
    const { client, net, goLive, clock } = createTestClient({ reload, session, wallClock: () => 2 });
    client.stream.subscribe("test.item.list", {}, () => {});
    const call = await goLive();
    net.refuseLive(signedOut);

    call.push(BYE);
    await flush();
    await clock.advance(30000);

    expect(reload).not.toHaveBeenCalled();
    client.close();
  });
});

describe("createLiveClient: lifecycle", () => {
  it("schedules with the injected timers and can cancel", async () => {
    const { client, clock } = createTestClient();
    const fired: string[] = [];
    client.schedule(() => fired.push("a"), 2000);
    const cancel = client.schedule(() => fired.push("b"), 2000);
    cancel();
    await clock.advance(2000);
    expect(fired).toEqual(["a"]);
  });

  it("closes the stream and drops overlays and their timers", async () => {
    const { client, clock, goLive } = createTestClient();
    const sub = client.stream.subscribe("test.item.list", {}, () => {});
    const call = await goLive();
    client.optimistic.apply(sub.id, "o1", () => ["x"]);
    client.optimistic.settle("o1");
    client.close();
    expect(call.aborted()).toBe(true);
    expect(client.stream.status()).toBe("closed");
    expect(client.optimistic.view(sub.id, ["a"])).toEqual(["a"]);
    expect(clock.pending()).toBe(0);
    expect(client.config).toBe(TEST_CONFIG);
  });
});

describe("provideLiveClient / useLiveClient", () => {
  const Reader = defineComponent({
    setup(_props, { expose }) {
      const client = useLiveClient();
      expose({ client });
      return () => h("i");
    },
  });

  it("provides the client app-wide", () => {
    const { client } = createTestClient();
    const app = createApp(Reader);
    provideLiveClient(client, app);
    const root = app.mount(document.createElement("div")) as unknown as { client: LiveClient };
    expect(root.client).toBe(client);
    app.unmount();
  });

  it("provides the client from a parent setup()", () => {
    const { client } = createTestClient();
    const Parent = defineComponent({
      setup() {
        provideLiveClient(client);
        return () => h(Reader, { ref: "reader" });
      },
    });
    const wrapper = mount(Parent);
    expect((wrapper.findComponent(Reader).vm as unknown as { client: LiveClient }).client).toBe(client);
    expect(LIVE_CLIENT_KEY.toString()).toContain("live-client");
  });

  it("fails with a clear message when nothing was provided or outside setup()", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => mount(Reader)).toThrow(/provideLiveClient/);
    warn.mockRestore();
    expect(() => useLiveClient()).toThrow(/provideLiveClient/);
    expect(() => provideLiveClient(createTestClient().client)).toThrow(/setup\(\)/);
  });
});
