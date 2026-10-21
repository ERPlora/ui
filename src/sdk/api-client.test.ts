import { afterEach, describe, expect, it } from "vitest";
import { createApiClient } from "./api-client";
import { ApiError } from "./errors";
import es from "./locales/es.json";
import type { HeaderProvider } from "./headers";
import type { OperationRoutes } from "./operations";

const ROUTES: OperationRoutes = {
  "test.item.list": { method: "get", path: "/api/test/items" },
  "test.item.detail": { method: "get", path: "/api/test/items/{id}" },
  "test.item.add_line": { method: "post", path: "/api/test/items/{id}/lines" },
  "test.item.delete": { method: "delete", path: "/api/test/items/{id}" },
  "test.session.me": { method: "get", path: "/api/session/me" },
};

const headers: HeaderProvider = {
  liveHeaders: () => ({ Accept: "text/event-stream" }),
  apiHeaders: (method) => ({
    "X-Device-Id": "dev-1",
    ...(method.toUpperCase() === "GET" ? {} : { "X-CSRFToken": "tok" }),
  }),
};

interface Recorded {
  url: string;
  init: RequestInit;
}

function setup(respond: () => Response | Promise<Response> = () => Response.json({ ok: true }), routes = ROUTES) {
  const calls: Recorded[] = [];
  const api = createApiClient({
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(respond());
    },
    headers,
    apiBase: "/api",
    routes,
  });
  return { api, calls, last: () => calls.at(-1) as Recorded };
}

const headersOf = (rec: Recorded) => rec.init.headers as Record<string, string>;

describe("createApiClient: queries (GET)", () => {
  it("sends the input as a query string and returns the parsed JSON", async () => {
    const h = setup(() => Response.json({ items: [], total: 0 }));
    const out = await h.api.call("test.item.list", { search: "a b", status: ["open", "done"], done: false, limit: 20 });
    expect(out).toEqual({ items: [], total: 0 });
    expect(h.last().url).toBe("/api/test/items?search=a+b&status=open&status=done&done=false&limit=20");
    expect(h.last().init.method).toBe("GET");
    expect(h.last().init.body).toBeUndefined();
    expect(h.last().init.credentials).toBe("same-origin");
    expect(headersOf(h.last())).toEqual({ "X-Device-Id": "dev-1", Accept: "application/json" });
  });

  it("skips undefined and null members and omits an empty query", async () => {
    const h = setup();
    await h.api.call("test.item.list", { search: undefined, limit: undefined });
    expect(h.last().url).toBe("/api/test/items");
    await h.api.call("test.session.me");
    expect(h.last().url).toBe("/api/session/me");
    await h.api.call("test.item.list", JSON.parse('{"search":null,"done":true}') as { done: boolean });
    expect(h.last().url).toBe("/api/test/items?done=true");
  });

  it("substitutes path parameters, encoded, and leaves them out of the query", async () => {
    const h = setup();
    await h.api.call("test.item.detail", { id: "a/b c" });
    expect(h.last().url).toBe("/api/test/items/a%2Fb%20c");
  });

  it("refuses nested objects in a query string", async () => {
    const h = setup();
    const input = JSON.parse('{"search":{"deep":1}}') as { search: string };
    await expect(h.api.call("test.item.list", input)).rejects.toThrow(/search/);
    expect(h.calls).toHaveLength(0);
  });
});

describe("createApiClient: commands", () => {
  it("sends the input minus path parameters as a JSON body with the unsafe-method headers", async () => {
    const h = setup(() => Response.json({ id: "l1", text: "x" }, { status: 201 }));
    const out = await h.api.call("test.item.add_line", { id: "i1", text: "x", client_line_id: "c1" });
    expect(out).toEqual({ id: "l1", text: "x" });
    expect(h.last().url).toBe("/api/test/items/i1/lines");
    expect(h.last().init.method).toBe("POST");
    expect(h.last().init.body).toBe('{"text":"x","client_line_id":"c1"}');
    expect(headersOf(h.last())).toEqual({
      "X-Device-Id": "dev-1",
      "X-CSRFToken": "tok",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
  });

  it("sends no body when a DELETE only carries path parameters, and resolves 204 to undefined", async () => {
    const h = setup(() => new Response(null, { status: 204 }));
    await expect(h.api.call("test.item.delete", { id: "i1" })).resolves.toBeUndefined();
    expect(h.last().url).toBe("/api/test/items/i1");
    expect(h.last().init.method).toBe("DELETE");
    expect(h.last().init.body).toBeUndefined();
    expect(headersOf(h.last())["Content-Type"]).toBeUndefined();
  });

  it("rejects when a path parameter is missing, without calling the server", async () => {
    const h = setup();
    const input = JSON.parse('{"text":"x","client_line_id":"c1"}') as { id: string; text: string; client_line_id: string };
    await expect(h.api.call("test.item.add_line", input)).rejects.toThrow(/"id"/);
    expect(h.calls).toHaveLength(0);
  });
});

describe("createApiClient: responses and errors", () => {
  it("turns the error envelope into an ApiError with its status, code and fields", async () => {
    const h = setup(() =>
      Response.json(
        { error: { code: "invalid_payload", message: "Check the form", fields: { text: ["Required"] } } },
        { status: 422 },
      ),
    );
    const err = (await h.api.call("test.item.add_line", { id: "i1", text: "", client_line_id: "c1" }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.code).toBe("invalid_payload");
    expect(err.fields).toEqual({ text: "Required" });
  });

  it("keeps the extra keys of the error envelope as details", async () => {
    const h = setup(() =>
      Response.json({ error: { code: "hubs.seat_limit", message: "No seat left", limit: 3, used: 3 } }, { status: 409 }),
    );
    const err = (await h.api.call("test.item.detail", { id: "i1" }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.details).toEqual({ limit: 3, used: 3 });
  });

  it("falls back to an unexpected_response error when the error body is not the envelope", async () => {
    const h = setup(() => new Response("<html>Bad gateway</html>", { status: 502 }));
    await expect(h.api.call("test.item.detail", { id: "i1" })).rejects.toMatchObject({
      status: 502,
      code: "unexpected_response",
    });
  });

  it("reports a 2xx body that is not JSON as unexpected_response, and an empty one as undefined", async () => {
    const bad = setup(() => new Response("nope", { status: 200 }));
    await expect(bad.api.call("test.item.detail", { id: "i1" })).rejects.toMatchObject({ code: "unexpected_response" });
    const empty = setup(() => new Response("", { status: 200 }));
    await expect(empty.api.call("test.item.detail", { id: "i1" })).resolves.toBeUndefined();
  });

  it("turns a network failure into a network_error ApiError with status 0", async () => {
    const h = setup(() => {
      throw new TypeError("Failed to fetch");
    });
    await expect(h.api.call("test.item.detail", { id: "i1" })).rejects.toMatchObject({
      name: "ApiError",
      status: 0,
      code: "network_error",
    });
  });

  describe("in the language of the page, never an English internal text (hub#2281)", () => {
    afterEach(() => {
      document.documentElement.lang = "";
    });

    it("says a 502 with a proxy's HTML page could not be completed and to try again", async () => {
      document.documentElement.lang = "es";
      const h = setup(() => new Response("<html>Bad gateway</html>", { status: 502 }));
      await expect(h.api.call("test.item.detail", { id: "i1" })).rejects.toMatchObject({
        status: 502,
        code: "unexpected_response",
        message: es.sdk.errors.unexpected,
      });
    });

    it("says a request that never got an answer could not reach the server, and keeps why for whoever debugs", async () => {
      document.documentElement.lang = "es";
      const h = setup(() => {
        throw new TypeError("Failed to fetch");
      });
      const err = (await h.api.call("test.item.detail", { id: "i1" }).catch((e: unknown) => e)) as ApiError;
      expect(err).toMatchObject({ status: 0, code: "network_error", message: es.sdk.errors.network });
      expect(err.details).toEqual({ reason: "Failed to fetch" });
    });
  });

  it("rejects an operation missing from the route map", async () => {
    const h = setup(undefined, { "test.item.list": ROUTES["test.item.list"] });
    await expect(h.api.call("test.session.me")).rejects.toThrow(/unknown operation "test\.session\.me"/);
    expect(h.calls).toHaveLength(0);
  });
});

describe("createApiClient: onError", () => {
  it("hands every error it rejects with to onError first", async () => {
    const seen: ApiError[] = [];
    const api = createApiClient({
      fetchImpl: () =>
        Promise.resolve(Response.json({ error: { code: "base.hub_suspended", message: "Suspended" } }, { status: 402 })),
      headers,
      apiBase: "/api",
      routes: ROUTES,
      onError: (error) => void seen.push(error),
    });
    const failed = await api.call("test.item.delete", { id: "i1" }).catch((err: unknown) => err);
    expect(failed).toBeInstanceOf(ApiError);
    expect(seen).toEqual([failed]);
    expect([seen[0].status, seen[0].code]).toEqual([402, "base.hub_suspended"]);
  });

  it("is not called for an answer that succeeds", async () => {
    const seen: ApiError[] = [];
    const api = createApiClient({
      fetchImpl: () => Promise.resolve(Response.json({ ok: true })),
      headers,
      apiBase: "/api",
      routes: ROUTES,
      onError: (error) => void seen.push(error),
    });
    await api.call("test.session.me");
    expect(seen).toEqual([]);
  });
});

describe("createApiClient: API base", () => {
  it("prefixes paths relative to the API base and keeps those already under it", async () => {
    const calls: string[] = [];
    const api = createApiClient({
      fetchImpl: (url) => {
        calls.push(url);
        return Promise.resolve(Response.json({}));
      },
      headers,
      apiBase: "/api/",
      routes: {
        "test.item.list": { method: "get", path: "/test/items" },
        "test.item.detail": { method: "get", path: "/api/test/items/{id}" },
        "test.session.me": { method: "get", path: "/api" },
      },
    });
    await api.call("test.item.list", {});
    await api.call("test.item.detail", { id: "i1" });
    await api.call("test.session.me");
    expect(calls).toEqual(["/api/test/items", "/api/test/items/i1", "/api"]);
  });
});
