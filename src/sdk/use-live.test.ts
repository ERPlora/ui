import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { defineComponent, effectScope, h, nextTick, ref, type MaybeRefOrGetter } from "vue";
import { BYE, createTestClient, errorFrame, flush, resultFrame } from "./__tests__/live-harness";
import { LIVE_CLIENT_KEY, type LiveClient } from "./live-client";
import type { InputOf, OpName } from "./operations";
import type { TestItemPage } from "./test-operations";
import { RELEASE_GRACE_MS, useLive, type UseLive } from "./use-live";

// Ionic fires its view hooks only inside IonRouterOutlet; here they are captured and fired by hand.
const ionic = vi.hoisted(() => ({ leave: [] as Array<() => void>, enter: [] as Array<() => void> }));
vi.mock("@ionic/vue", () => ({
  onIonViewDidLeave: (hook: () => void) => void ionic.leave.push(hook),
  onIonViewWillEnter: (hook: () => void) => void ionic.enter.push(hook),
}));

beforeEach(() => {
  ionic.leave.length = 0;
  ionic.enter.length = 0;
});

function mountLive<Op extends OpName>(client: LiveClient, op: Op, params: MaybeRefOrGetter<InputOf<Op>>) {
  const box: { live?: UseLive<unknown> } = {};
  const Probe = defineComponent({
    setup() {
      const live = useLive(op, params as never);
      box.live = live as UseLive<unknown>;
      return () => h("pre", JSON.stringify(live.data.value ?? null));
    },
  });
  const wrapper = mount(Probe, { global: { provide: { [LIVE_CLIENT_KEY as symbol]: client } } });
  return { wrapper, live: box.live as UseLive<unknown> };
}

const listSubs = (client: LiveClient) => client.stream.subscriptions("test.item.list");

describe("useLive: subscription and status", () => {
  it("subscribes on mount, is loading until the first result and live after it", async () => {
    const t = createTestClient();
    const { live, wrapper } = mountLive(t.client, "test.item.list", { search: "a" });
    expect(listSubs(t.client)).toEqual([{ id: expect.any(String), params: { search: "a" } }]);
    expect(live.status.value).toBe("loading");
    expect(live.data.value).toBeUndefined();
    const call = await t.goLive();
    call.push(resultFrame(listSubs(t.client)[0].id, { items: [], total: 0 }, 1));
    await flush();
    expect(live.data.value).toEqual({ items: [], total: 0 });
    expect(live.status.value).toBe("live");
    expect(live.error.value).toBeNull();
    expect(wrapper.text()).toBe('{"items":[],"total":0}');
  });

  it("keeps the data on an error frame and reports reconnecting while the stream recovers", async () => {
    const t = createTestClient();
    const { live } = mountLive(t.client, "test.item.list", {});
    const call = await t.goLive();
    const id = listSubs(t.client)[0].id;
    call.push(resultFrame(id, { items: [], total: 3 }, 1));
    call.push(errorFrame(id, "app_inactive"));
    await flush();
    expect(live.status.value).toBe("error");
    expect(live.error.value?.code).toBe("app_inactive");
    expect(live.data.value).toEqual({ items: [], total: 3 });
    call.push(BYE);
    await flush();
    expect(live.status.value).toBe("reconnecting");
    await t.clock.advance(3000);
    t.net.lastStream().push(resultFrame(id, { items: [], total: 4 }, 1));
    await flush();
    expect(live.status.value).toBe("reconnecting");
    t.net.lastStream().push("event: hello\ndata: {}\n\n");
    await flush();
    expect(live.status.value).toBe("live");
    expect(live.error.value).toBeNull();
    expect(live.data.value).toEqual({ items: [], total: 4 });
  });

  it("refresh() reopens the stream so the server runs the query again", async () => {
    const t = createTestClient();
    const { live } = mountLive(t.client, "test.item.list", {});
    await t.goLive();
    live.refresh();
    expect(t.net.streams).toHaveLength(2);
  });
});

describe("useLive: reactive params", () => {
  it("re-subscribes on a deep change, keeping the previous data until the new result", async () => {
    const t = createTestClient();
    const params = ref({ search: "a", status: ["open"] });
    const { live } = mountLive(t.client, "test.item.list", params);
    const call = await t.goLive();
    const first = listSubs(t.client)[0].id;
    call.push(resultFrame(first, { items: [], total: 1 }, 1));
    await flush();

    params.value.status.push("done");
    await nextTick();
    expect(listSubs(t.client)).toEqual([{ id: expect.any(String), params: { search: "a", status: ["open", "done"] } }]);
    expect(live.status.value).toBe("loading");
    expect(live.data.value).toEqual({ items: [], total: 1 });

    await t.clock.advance(150);
    expect(t.net.streams).toHaveLength(2);
    const second = t.net.lastStream();
    expect(second.subs.map((s) => s.params)).toEqual([{ search: "a", status: ["open", "done"] }]);
    second.push(resultFrame(second.subs[0].id, { items: [], total: 2 }, 1));
    await flush();
    expect(live.data.value).toEqual({ items: [], total: 2 });
    expect(live.status.value).toBe("live");
  });

  it("accepts a getter and ignores changes that keep the same content", async () => {
    const t = createTestClient();
    const search = ref("a");
    const limit = ref(20);
    mountLive(t.client, "test.item.list", () => ({ limit: limit.value, search: search.value }));
    await t.goLive();
    search.value = "a";
    limit.value = 20;
    await nextTick();
    await t.clock.advance(1000);
    expect(t.net.streams).toHaveLength(1);
    search.value = "b";
    await nextTick();
    await t.clock.advance(150);
    expect(t.net.streams).toHaveLength(2);
    expect(t.net.lastStream().subs[0].params).toEqual({ limit: 20, search: "b" });
  });
});

describe("useLive: Ionic pause and unmount grace", () => {
  it("releases the subscription 2 s after ionViewDidLeave and resubscribes on ionViewWillEnter, keeping the data", async () => {
    const t = createTestClient();
    const { live } = mountLive(t.client, "test.item.list", {});
    const call = await t.goLive();
    call.push(resultFrame(listSubs(t.client)[0].id, { items: [], total: 1 }, 1));
    await flush();

    for (const hook of ionic.leave) hook();
    await t.clock.advance(RELEASE_GRACE_MS - 1);
    expect(listSubs(t.client)).toHaveLength(1);
    await t.clock.advance(1);
    expect(listSubs(t.client)).toHaveLength(0);
    expect(live.data.value).toEqual({ items: [], total: 1 });
    await t.clock.advance(150);
    expect(t.client.stream.status()).toBe("idle");

    for (const hook of ionic.enter) hook();
    expect(listSubs(t.client)).toHaveLength(1);
    expect(live.status.value).toBe("loading");
    expect(live.data.value).toEqual({ items: [], total: 1 });
    const back = await t.goLive();
    back.push(resultFrame(listSubs(t.client)[0].id, { items: [], total: 2 }, 1));
    await flush();
    expect(live.status.value).toBe("live");
    expect(live.data.value).toEqual({ items: [], total: 2 });
    expect(RELEASE_GRACE_MS).toBe(2000);
  });

  it("keeps the subscription and the stream when the page comes back within the grace", async () => {
    const t = createTestClient();
    const { live } = mountLive(t.client, "test.item.list", {});
    const call = await t.goLive();
    call.push(resultFrame(listSubs(t.client)[0].id, { items: [], total: 1 }, 1));
    await flush();
    for (const hook of ionic.leave) hook();
    await t.clock.advance(1000);
    for (const hook of ionic.enter) hook();
    await t.clock.advance(5000);
    expect(listSubs(t.client)).toHaveLength(1);
    expect(t.net.streams).toHaveLength(1);
    expect(live.status.value).toBe("live");
  });

  it("subscribes with the latest params when the page comes back after params changed while away", async () => {
    const t = createTestClient();
    const params = ref({ search: "a" });
    mountLive(t.client, "test.item.list", params);
    await t.goLive();
    for (const hook of ionic.leave) hook();
    await t.clock.advance(RELEASE_GRACE_MS);
    params.value = { search: "b" };
    await nextTick();
    expect(listSubs(t.client)).toHaveLength(0);
    for (const hook of ionic.enter) hook();
    expect(listSubs(t.client)).toEqual([{ id: expect.any(String), params: { search: "b" } }]);
  });

  it("releases 2 s after unmount, so a quick remount reuses the cached result without reopening", async () => {
    const t = createTestClient();
    const first = mountLive(t.client, "test.item.list", {});
    const call = await t.goLive();
    call.push(resultFrame(listSubs(t.client)[0].id, { items: [], total: 1 }, 1));
    await flush();
    first.wrapper.unmount();
    await t.clock.advance(1000);
    const again = mountLive(t.client, "test.item.list", {});
    expect(again.live.data.value).toEqual({ items: [], total: 1 });
    expect(again.live.status.value).toBe("live");
    await t.clock.advance(5000);
    expect(listSubs(t.client)).toHaveLength(1);
    expect(t.net.streams).toHaveLength(1);

    again.wrapper.unmount();
    await t.clock.advance(RELEASE_GRACE_MS + 150);
    expect(listSubs(t.client)).toHaveLength(0);
    expect(t.client.stream.status()).toBe("idle");
  });
});

describe("useLive: optimistic overlays and use outside components", () => {
  it("shows overlays over the server data and the exact server data after a rollback", async () => {
    const t = createTestClient();
    const { live } = mountLive(t.client, "test.item.list", {});
    const call = await t.goLive();
    const id = listSubs(t.client)[0].id;
    const server = { items: [], total: 1 };
    call.push(resultFrame(id, server, 1));
    await flush();
    t.client.optimistic.apply(id, "o1", (cur) => ({ ...(cur as TestItemPage), total: 2 }));
    expect(live.data.value).toEqual({ items: [], total: 2 });
    t.client.optimistic.rollback("o1");
    expect(live.data.value).toEqual(server);
  });

  it("runs inside an effect scope with an explicit client and releases when the scope stops", async () => {
    const t = createTestClient();
    const scope = effectScope();
    const live = scope.run(() => useLive("test.item.list", { search: "x" }, { client: t.client })) as UseLive<TestItemPage>;
    expect(listSubs(t.client)).toHaveLength(1);
    expectTypeOf(live.data.value).toEqualTypeOf<TestItemPage | undefined>();
    scope.stop();
    await t.clock.advance(RELEASE_GRACE_MS);
    expect(listSubs(t.client)).toHaveLength(0);
  });

  it("lets operations without input omit the params", () => {
    const t = createTestClient();
    const scope = effectScope();
    const live = scope.run(() => useLive("test.session.me", undefined, { client: t.client }));
    expectTypeOf(live?.data.value).toEqualTypeOf<{ user: string } | undefined>();
    expect(t.client.stream.subscriptions("test.session.me")).toEqual([{ id: expect.any(String), params: {} }]);
    scope.stop();
  });
});
