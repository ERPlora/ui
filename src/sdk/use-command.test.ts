import { mount } from "@vue/test-utils";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { defineComponent, effectScope, h } from "vue";
import { createTestClient, flush, resultFrame } from "./__tests__/live-harness";
import { ApiError, isConflict } from "./errors";
import { LIVE_CLIENT_KEY, type LiveClient } from "./live-client";
import { SETTLE_TIMEOUT_MS } from "./optimistic";
import type { TestItem, TestItemPage, TestLine } from "./test-operations";
import { type OptimisticUpdates, useCommand, type UseCommand } from "./use-command";
import { useLive, type UseLive } from "./use-live";

vi.mock("@ionic/vue", () => ({ onIonViewDidLeave: () => {}, onIonViewWillEnter: () => {} }));

function deferred() {
  let resolve!: (res: Response) => void;
  const promise = new Promise<Response>((r) => (resolve = r));
  return { promise, resolve };
}

const ITEM: TestItem = { id: "i1", name: "Table 4", lines: [{ id: "l1", text: "Water" }] };
const conflict = () => Response.json({ error: { code: "demo.item_done", message: "The item is closed" } }, { status: 409 });
const created = (line: TestLine) => Response.json(line, { status: 201 });

function addLine(client: LiveClient) {
  return useCommand("test.item.add_line", {
    client,
    optimistic: {
      "test.item.detail": (current, input) => ({
        ...(current as TestItem),
        lines: [...(current?.lines ?? []), { id: input.client_line_id, text: input.text }],
      }),
      "test.item.list": (current) => ({ items: current?.items ?? [], total: (current?.total ?? 0) + 1 }),
    },
  });
}

/** Detail of i1 plus two lists with different params, all live with a first result. */
async function setup() {
  const t = createTestClient();
  const scope = effectScope();
  const views = scope.run(() => ({
    detail: useLive("test.item.detail", { id: "i1" }, { client: t.client }),
    listA: useLive("test.item.list", { search: "a" }, { client: t.client }),
    listB: useLive("test.item.list", { search: "b" }, { client: t.client }),
    command: addLine(t.client),
  })) as {
    detail: UseLive<TestItem>;
    listA: UseLive<TestItemPage>;
    listB: UseLive<TestItemPage>;
    command: UseCommand<"test.item.add_line">;
  };
  const call = await t.goLive();
  const ids = {
    detail: t.client.stream.subscriptions("test.item.detail")[0].id,
    lists: t.client.stream.subscriptions("test.item.list").map((s) => s.id),
  };
  call.push(resultFrame(ids.detail, ITEM, 1));
  for (const id of ids.lists) call.push(resultFrame(id, { items: [], total: 1 }, 1));
  await flush();
  return { ...t, ...views, call, ids, scope };
}

const input = (text: string, clientLineId: string) => ({ id: "i1", text, client_line_id: clientLineId });

describe("useCommand: optimistic run", () => {
  it("changes the data of every subscription of the declared queries at once", async () => {
    const s = await setup();
    const reply = deferred();
    s.net.onApi(() => reply.promise);
    const running = s.command.run(input("Bread", "c1"));
    expect(s.detail.data.value?.lines).toEqual([
      { id: "l1", text: "Water" },
      { id: "c1", text: "Bread" },
    ]);
    expect(s.listA.data.value?.total).toBe(2);
    expect(s.listB.data.value?.total).toBe(2);
    expect(s.command.pending.value).toBe(true);
    expect(s.net.api[0].url).toBe("/api/test/items/i1/lines");
    expect(s.net.api[0].init.body).toBe('{"text":"Bread","client_line_id":"c1"}');
    reply.resolve(created({ id: "l2", text: "Bread" }));
    await expect(running).resolves.toEqual({ id: "l2", text: "Bread" });
    expect(s.command.pending.value).toBe(false);
    expect(s.command.error.value).toBeNull();
  });

  it("rolls back to the exact server data on a 409 and exposes the error", async () => {
    const s = await setup();
    const before = s.detail.data.value;
    s.net.onApi(conflict);
    const err = await s.command.run(input("Bread", "c1")).catch((e: unknown) => e);
    expect(isConflict(err)).toBe(true);
    expect(s.detail.data.value).toBe(before);
    expect(s.listA.data.value).toEqual({ items: [], total: 1 });
    expect(s.command.error.value).toBeInstanceOf(ApiError);
    expect(s.command.error.value?.code).toBe("demo.item_done");
    expect(s.command.pending.value).toBe(false);
  });

  it("keeps the overlay after success until a newer result arrives, then the server wins", async () => {
    const s = await setup();
    s.net.onApi(() => created({ id: "l2", text: "Bread" }));
    await s.command.run(input("Bread", "c1"));
    s.call.push(resultFrame(s.ids.detail, ITEM, 1));
    await flush();
    expect(s.detail.data.value?.lines).toHaveLength(2);

    const server: TestItem = { ...ITEM, lines: [...ITEM.lines, { id: "l2", text: "Bread" }] };
    s.call.push(resultFrame(s.ids.detail, server, 2));
    await flush();
    expect(s.detail.data.value).toEqual(server);

    expect(s.listA.data.value?.total).toBe(2);
    await s.clock.advance(SETTLE_TIMEOUT_MS);
    expect(s.listA.data.value?.total).toBe(1);
  });

  it("composes two concurrent runs in order and stays pending until both finish", async () => {
    const s = await setup();
    const first = deferred();
    const second = deferred();
    const replies = [first, second];
    s.net.onApi(() => (replies.shift() as ReturnType<typeof deferred>).promise);
    const a = s.command.run(input("Bread", "c1")).catch((e: unknown) => e);
    const b = s.command.run(input("Wine", "c2"));
    expect(s.detail.data.value?.lines.map((l) => l.text)).toEqual(["Water", "Bread", "Wine"]);
    expect(s.listA.data.value?.total).toBe(3);

    second.resolve(created({ id: "l3", text: "Wine" }));
    await b;
    expect(s.command.pending.value).toBe(true);
    first.resolve(conflict());
    expect(await a).toBeInstanceOf(ApiError);
    expect(s.command.pending.value).toBe(false);
    expect(s.detail.data.value?.lines.map((l) => l.text)).toEqual(["Water", "Wine"]);
    expect(s.listA.data.value?.total).toBe(2);
  });
});

describe("useCommand: without overlays and from components", () => {
  it("just calls the API, and turns a programming error into a visible client_error", async () => {
    const t = createTestClient({ routes: { "test.item.delete": { method: "delete", path: "/api/test/items/{id}" } } });
    const scope = effectScope();
    const del = scope.run(() => useCommand("test.item.delete", { client: t.client })) as UseCommand<"test.item.delete">;
    t.net.onApi(() => new Response(null, { status: 204 }));
    await expect(del.run({ id: "i1" })).resolves.toBeUndefined();
    expect(t.net.api[0].init.method).toBe("DELETE");

    const add = scope.run(() => addLine(t.client)) as UseCommand<"test.item.add_line">;
    await expect(add.run(input("Bread", "c1"))).rejects.toThrow(/unknown operation/);
    expect(add.error.value?.code).toBe("client_error");
    expect(add.error.value?.message).toMatch(/unknown operation/);
    expectTypeOf(add.run).parameter(0).toEqualTypeOf<{ id: string; text: string; client_line_id: string }>();
    expectTypeOf(add.run).returns.resolves.toEqualTypeOf<TestLine>();
  });

  it("takes the injected client inside a component", async () => {
    const t = createTestClient();
    const box: { cmd?: UseCommand<"test.item.add_line"> } = {};
    const Probe = defineComponent({
      setup() {
        box.cmd = useCommand("test.item.add_line");
        return () => h("i");
      },
    });
    mount(Probe, { global: { provide: { [LIVE_CLIENT_KEY as symbol]: t.client } } });
    t.net.onApi(() => created({ id: "l9", text: "x" }));
    await expect(box.cmd?.run(input("x", "c9"))).resolves.toEqual({ id: "l9", text: "x" });
  });
});

describe("useCommand: an updater may skip a subscription", () => {
  /** Adds the line only where the detail is loaded; returns undefined (no overlay) otherwise. */
  const withLine: OptimisticUpdates<"test.item.add_line"> = {
    "test.item.detail": (current, input) =>
      current && { ...current, lines: [...current.lines, { id: input.client_line_id, text: input.text }] },
  };

  it("types the updater as (current | undefined) => output | undefined", () => {
    type Updater = NonNullable<OptimisticUpdates<"test.item.add_line">["test.item.list"]>;
    expectTypeOf<Parameters<Updater>[0]>().toEqualTypeOf<TestItemPage | undefined>();
    expectTypeOf<ReturnType<Updater>>().toEqualTypeOf<TestItemPage | undefined>();
  });

  it("lays no overlay where the updater returns undefined, and still lays the others", async () => {
    const s = await setup();
    const listBefore = s.listA.data.value;
    const cmd = s.scope.run(() =>
      useCommand("test.item.add_line", { client: s.client, optimistic: { ...withLine, "test.item.list": () => undefined } }),
    ) as UseCommand<"test.item.add_line">;
    const reply = deferred();
    s.net.onApi(() => reply.promise);
    const running = cmd.run(input("Bread", "c1"));
    expect(s.detail.data.value?.lines.map((l) => l.text)).toEqual(["Water", "Bread"]);
    expect(s.listA.data.value).toBe(listBefore);
    expect(s.listB.data.value).toEqual({ items: [], total: 1 });
    reply.resolve(created({ id: "l2", text: "Bread" }));
    await running;
    expect(s.listA.data.value).toBe(listBefore);
  });

  it("calls the updater with undefined before the first result and ignores its undefined answer", async () => {
    const t = createTestClient();
    const scope = effectScope();
    const seen: Array<TestItem | undefined> = [];
    const { detail, cmd } = scope.run(() => ({
      detail: useLive("test.item.detail", { id: "i1" }, { client: t.client }),
      cmd: useCommand("test.item.add_line", {
        client: t.client,
        optimistic: {
          "test.item.detail": (current, input) => {
            seen.push(current);
            return withLine["test.item.detail"]?.(current, input);
          },
        },
      }),
    })) as { detail: UseLive<TestItem>; cmd: UseCommand<"test.item.add_line"> };
    const call = await t.goLive();
    const reply = deferred();
    t.net.onApi(() => reply.promise);
    const running = cmd.run(input("Bread", "c1"));
    expect(detail.data.value).toBeUndefined();
    expect(seen).toContain(undefined);
    expect(detail.status.value).toBe("loading");

    call.push(resultFrame(t.client.stream.subscriptions("test.item.detail")[0].id, ITEM, 1));
    await flush();
    expect(detail.data.value?.lines.map((l) => l.text)).toEqual(["Water", "Bread"]);
    reply.resolve(created({ id: "l2", text: "Bread" }));
    await running;
  });
});
