import { describe, expect, it } from "vitest";
import { ApiError, fieldErrors, isConflict, isUnauthorized, parseErrorEnvelope } from "./errors";

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
});

describe("parseErrorEnvelope", () => {
  it("reads the single error envelope", () => {
    const err = parseErrorEnvelope(409, { error: { code: "demo.item_done", message: "Item is closed" } });
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.code).toBe("demo.item_done");
    expect(err.message).toBe("Item is closed");
    expect(err.fields).toBeUndefined();
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

  it("falls back to a generic error when the body is not an envelope", () => {
    for (const body of [null, undefined, "<html>502</html>", { detail: "x" }, { error: "x" }, { error: {} }]) {
      const err = parseErrorEnvelope(502, body);
      expect(err.status).toBe(502);
      expect(err.code).toBe("unexpected_response");
      expect(err.message).toBe("Unexpected response (HTTP 502)");
    }
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
});

describe("status helpers", () => {
  it("detects a conflict", () => {
    expect(isConflict(new ApiError(409, "demo.item_done", "Closed"))).toBe(true);
    expect(isConflict(new ApiError(400, "bad", "Bad"))).toBe(false);
    expect(isConflict(new Error("409"))).toBe(false);
  });

  it("detects an unauthorized error", () => {
    expect(isUnauthorized(new ApiError(401, "not_authenticated", "Login"))).toBe(true);
    expect(isUnauthorized(new ApiError(403, "permission_denied", "No"))).toBe(false);
    expect(isUnauthorized("401")).toBe(false);
  });
});
