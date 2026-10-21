import { afterEach, describe, expect, expectTypeOf, it } from "vitest";
import { ApiError, type ErrorDetails, fieldErrors, isConflict, isUnauthorized, parseErrorEnvelope } from "./errors";
import en from "./locales/en.json";
import es from "./locales/es.json";

describe("ApiError", () => {
  it("is an Error with status, code, message and fields", () => {
    const err = new ApiError(422, "invalid_payload", "Invalid data", { name: "Required" });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("ApiError");
    expect(err.status).toBe(422);
    expect(err.code).toBe("invalid_payload");
    expect(err.message).toBe("Invalid data");
    expect(err.fields).toEqual({ name: "Required" });
  });

  it("has no details unless given", () => {
    expect(new ApiError(409, "demo.item_done", "Closed").details).toEqual({});
  });

  it("keeps a copy of the details it is given", () => {
    const details = { limit: 3, used: 3 };
    const err = new ApiError(409, "hubs.seat_limit", "No seat left", undefined, details);
    details.used = 4;
    expect(err.details).toEqual({ limit: 3, used: 3 });
    expect(err.fields).toBeUndefined();
  });

  it("types details as a record of unknown values", () => {
    expectTypeOf<ApiError["details"]>().toEqualTypeOf<ErrorDetails>();
    expectTypeOf<ErrorDetails>().toEqualTypeOf<Record<string, unknown>>();
  });
});

describe("parseErrorEnvelope", () => {
  it("reads the single error envelope", () => {
    const err = parseErrorEnvelope(409, { error: { code: "demo.item_done", message: "Item is closed" } });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("demo.item_done");
    expect(err.message).toBe("Item is closed");
    expect(err.fields).toBeUndefined();
    expect(err.details).toEqual({});
  });

  it("keeps every extra key of the error object as details", () => {
    const err = parseErrorEnvelope(409, {
      error: { code: "hubs.seat_limit", message: "No seat left", limit: 3, used: 3, meta: { plan: "free" } },
    });
    expect(err.code).toBe("hubs.seat_limit");
    expect(err.message).toBe("No seat left");
    expect(err.details).toEqual({ limit: 3, used: 3, meta: { plan: "free" } });
    expect(err.fields).toBeUndefined();
  });

  it("keeps details next to the field messages, without code, message or fields in them", () => {
    const err = parseErrorEnvelope(429, {
      error: { code: "rate_limited", message: "Slow down", fields: { name: "Required" }, retry_after: 30 },
    });
    expect(err.fields).toEqual({ name: "Required" });
    expect(err.details).toEqual({ retry_after: 30 });
  });

  it("reads details from an envelope given as a JSON string", () => {
    const err = parseErrorEnvelope(429, '{"error":{"code":"rate_limited","message":"Slow down","retry_after":30}}');
    expect(err.details).toEqual({ retry_after: 30 });
  });

  it("keeps field messages", () => {
    const err = parseErrorEnvelope(422, {
      error: { code: "invalid_payload", message: "Invalid", fields: { name: "Required", qty: "Too big" } },
    });
    expect(err.fields).toEqual({ name: "Required", qty: "Too big" });
  });

  it("joins a list of messages for one field", () => {
    const err = parseErrorEnvelope(422, {
      error: { code: "invalid_payload", message: "Invalid", fields: { name: ["Required", "Too short"] } },
    });
    expect(err.fields).toEqual({ name: "Required Too short" });
  });

  it("accepts the envelope as a JSON string", () => {
    const err = parseErrorEnvelope(403, '{"error":{"code":"permission_denied","message":"No"}}');
    expect(err.code).toBe("permission_denied");
  });

  afterEach(() => {
    document.documentElement.lang = "";
  });

  it("falls back to a generic error when the body is not an envelope", () => {
    for (const body of [null, undefined, "", "<html>502</html>", { detail: "x" }, { error: "x" }, { error: {} }]) {
      const err = parseErrorEnvelope(502, body);
      expect(err.status).toBe(502);
      expect(err.code).toBe("unexpected_response");
      expect(err.message).toBe(en.sdk.errors.unexpected);
      expect(err.details).toEqual({});
    }
  });

  it("words that generic error for a person, in the language of the page (hub#2281)", () => {
    document.documentElement.lang = "es";
    const err = parseErrorEnvelope(502, "<html><body>502 Bad Gateway</body></html>");
    expect(err).toMatchObject({ status: 502, code: "unexpected_response", message: es.sdk.errors.unexpected });
    expect(err.message).not.toMatch(/Unexpected response|HTTP/);
  });
});

describe("fieldErrors", () => {
  it("returns field messages of a 422", () => {
    const err = new ApiError(422, "invalid_payload", "Invalid", { name: "Required" });
    expect(fieldErrors(err)).toEqual({ name: "Required" });
  });

  it("returns an empty object for anything else", () => {
    expect(fieldErrors(new ApiError(422, "invalid_payload", "Invalid"))).toEqual({});
    expect(fieldErrors(new ApiError(400, "bad", "Bad", { name: "x" }))).toEqual({});
    expect(fieldErrors(new Error("boom"))).toEqual({});
    expect(fieldErrors(undefined)).toEqual({});
  });

  it("ignores details", () => {
    const err = parseErrorEnvelope(422, {
      error: { code: "invalid_payload", message: "Invalid", fields: { name: "Required" }, hint: "x" },
    });
    expect(fieldErrors(err)).toEqual({ name: "Required" });
  });
});

describe("status helpers", () => {
  it("detects a conflict", () => {
    expect(isConflict(new ApiError(409, "demo.item_done", "Closed"))).toBe(true);
    expect(isConflict(new ApiError(400, "bad", "Bad"))).toBe(false);
    expect(isConflict(new Error("409"))).toBe(false);
    expect(isConflict(parseErrorEnvelope(409, { error: { code: "hubs.seat_limit", message: "Full", limit: 3 } }))).toBe(true);
  });

  it("detects an unauthorized error", () => {
    expect(isUnauthorized(new ApiError(401, "not_authenticated", "Login"))).toBe(true);
    expect(isUnauthorized(new ApiError(403, "permission_denied", "No"))).toBe(false);
    expect(isUnauthorized("401")).toBe(false);
    expect(isUnauthorized(parseErrorEnvelope(401, { error: { code: "unauthorized", message: "Login", next: "/" } }))).toBe(true);
  });
});
