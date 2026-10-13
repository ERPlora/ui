import { describe, expect, it } from "vitest";
import { encodeSubscriptions, fnv1a, limitWarnings, stableJson, subscriptionId } from "./subscriptions";

function decode(s: string): unknown {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

describe("stableJson", () => {
  it("sorts object keys at every depth", () => {
    expect(stableJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: 2 } })).toBe('{"a":{"c":2,"d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it("gives the same text for the same params in another key order", () => {
    expect(stableJson({ search: "x", limit: 20 })).toBe(stableJson({ limit: 20, search: "x" }));
  });

  it("drops undefined members like JSON does and maps undefined params to an empty object", () => {
    expect(stableJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(stableJson(undefined)).toBe("{}");
  });
});

describe("fnv1a", () => {
  it("matches the FNV-1a 32-bit reference values", () => {
    expect(fnv1a("")).toBe("811c9dc5");
    expect(fnv1a("a")).toBe("e40c292c");
    expect(fnv1a("foobar")).toBe("bf9cf968");
  });
});

describe("subscriptionId", () => {
  it("is stable for the same op and params and differs otherwise", () => {
    const a = subscriptionId("demo.item.list", stableJson({ limit: 20 }));
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(subscriptionId("demo.item.list", stableJson({ limit: 20 }))).toBe(a);
    expect(subscriptionId("demo.item.list", stableJson({ limit: 21 }))).not.toBe(a);
    expect(subscriptionId("demo.item.stats", stableJson({ limit: 20 }))).not.toBe(a);
  });
});

describe("encodeSubscriptions", () => {
  it("encodes the list as unpadded base64url of its JSON", () => {
    const list = [
      { id: "a1", op: "demo.item.list", params: { search: "café ☕?", limit: 20 } },
      { id: "b2", op: "demo.item.stats", params: {} },
    ];
    const s = encodeSubscriptions(list);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decode(s)).toEqual(list);
  });

  it("encodes an empty list", () => {
    expect(decode(encodeSubscriptions([]))).toEqual([]);
  });
});

describe("limitWarnings", () => {
  it("is empty within the limits", () => {
    expect(limitWarnings(50, "a".repeat(12 * 1024))).toEqual([]);
  });

  it("warns above 50 subscriptions and above 12 KB of query", () => {
    expect(limitWarnings(51, "abc")).toEqual(["live: 51 subscriptions exceed the limit of 50"]);
    expect(limitWarnings(1, "a".repeat(12 * 1024 + 1))).toEqual([
      "live: the subscription list exceeds 12 KB (12289 bytes)",
    ]);
  });
});
