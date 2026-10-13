import { describe, expect, expectTypeOf, it } from "vitest";
import {
  isQueryRoute,
  parseOperationRoutes,
  type InputOf,
  type OperationRoutes,
  type OpName,
  type OutputOf,
} from "./operations";
import type { TestItem, TestItemPage } from "./test-operations";

describe("operation types", () => {
  it("are keyed by the operation names a project augments", () => {
    expectTypeOf<"test.item.list">().toExtend<OpName>();
    expectTypeOf<InputOf<"test.item.detail">>().toEqualTypeOf<{ id: string }>();
    expectTypeOf<OutputOf<"test.item.detail">>().toEqualTypeOf<TestItem>();
    expectTypeOf<OutputOf<"test.item.list">>().toEqualTypeOf<TestItemPage>();
    // @ts-expect-error an operation that nobody declared is not a valid name
    expectTypeOf<InputOf<"test.nope.list">>().toBeNever();
  });
});

describe("isQueryRoute", () => {
  it("treats GET routes as queries and every other method as a command", () => {
    expect(isQueryRoute({ method: "get", path: "/api/demo/items" })).toBe(true);
    for (const method of ["post", "patch", "put", "delete"] as const) {
      expect(isQueryRoute({ method, path: "/api/demo/items" })).toBe(false);
    }
  });
});

describe("parseOperationRoutes", () => {
  const valid: OperationRoutes = {
    "demo.item.list": { method: "get", path: "/api/demo/items" },
    "demo.item.add_line": { method: "post", path: "/api/demo/items/{id}/lines" },
  };

  it("accepts the generated op → route map and returns a copy", () => {
    const raw: unknown = JSON.parse(JSON.stringify(valid));
    const routes = parseOperationRoutes(raw);
    expect(routes).toEqual(valid);
    expect(routes).not.toBe(raw);
  });

  it("rejects anything that is not an object of routes", () => {
    expect(() => parseOperationRoutes(null)).toThrow(TypeError);
    expect(() => parseOperationRoutes([])).toThrow(/object/);
    expect(() => parseOperationRoutes({ "demo.item.list": "GET /api/demo/items" })).toThrow(/demo\.item\.list/);
  });

  it("rejects unknown methods and paths that are not absolute", () => {
    expect(() => parseOperationRoutes({ "demo.item.list": { method: "GET", path: "/api/x" } })).toThrow(/method/);
    expect(() => parseOperationRoutes({ "demo.item.list": { method: "head", path: "/api/x" } })).toThrow(/method/);
    expect(() => parseOperationRoutes({ "demo.item.list": { method: "get", path: "api/x" } })).toThrow(/path/);
    expect(() => parseOperationRoutes({ "demo.item.list": { method: "get" } })).toThrow(/path/);
  });
});
