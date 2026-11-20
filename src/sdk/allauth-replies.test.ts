import { afterEach, describe, expect, it } from "vitest";

import {
  authenticatorOf,
  errorOf,
  flowsOf,
  isReauthenticationRequired,
  isRecord,
  providerAccountsOf,
  ReauthenticationRequiredError,
  recoveryCodesOf,
  unexpected,
} from "./allauth-replies";
import { ApiError } from "./errors";
import en from "./locales/en.json";
import es from "./locales/es.json";

function thrown(read: () => unknown): unknown {
  try {
    read();
  } catch (err) {
    return err;
  }
  throw new Error("expected the reader to throw");
}

afterEach(() => {
  document.documentElement.lang = "";
});

describe("isRecord", () => {
  it("is true only for an object, never for null, a list or a plain value", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ user: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord("user")).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe("errorOf", () => {
  it("puts each message under its param, and one without a param under __all__", () => {
    const err = errorOf(400, [
      { param: "email", code: "invalid", message: "Enter a valid email address." },
      { code: "too_many_login_attempts", message: "Too many failed login attempts." },
      { param: 3, code: "invalid", message: "Not a field name." },
    ]);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: "invalid", message: "Enter a valid email address." });
    expect(err.fields).toEqual({
      email: "Enter a valid email address.",
      __all__: "Too many failed login attempts. Not a field name.",
    });
  });

  it("joins the messages of one field with a space", () => {
    const err = errorOf(400, [
      { param: "password", code: "password_too_short", message: "This password is too short." },
      { param: "password", code: "password_too_common", message: "This password is too common." },
    ]);
    expect(err.fields).toEqual({ password: "This password is too short. This password is too common." });
  });

  it("takes code and message from the first error that has a message, skipping what is not an error", () => {
    const err = errorOf(400, [
      null,
      "invalid",
      ["x"],
      { code: "no_message" },
      { param: "key", code: "invalid_password_reset", message: "Invalid key." },
    ]);
    expect(err).toMatchObject({ code: "invalid_password_reset", message: "Invalid key.", fields: { key: "Invalid key." } });
  });

  it("names the failure after its status when allauth words no code", () => {
    expect(errorOf(403, []).code).toBe("forbidden");
    expect(errorOf(404, undefined).code).toBe("not_found");
    expect(errorOf(409, "conflict").code).toBe("conflict");
    expect(errorOf(429, [{ code: 7, message: "Slow down." }]).code).toBe("too_many_requests");
    expect(errorOf(500, []).code).toBe("error");
  });

  it("says, in the language of the page, that it could not be completed when no error has a message, without fields", () => {
    document.documentElement.lang = "es";
    const err = errorOf(500, [{ code: "server_error" }]);
    expect(err).toMatchObject({ status: 500, code: "error", message: es.sdk.errors.unexpected });
    expect(err.fields).toBeUndefined();
  });
});

describe("unexpected", () => {
  it("is an ApiError with the answer's status, its own code and the sentence of an answer that is not allauth's", () => {
    document.documentElement.lang = "en";
    const err = unexpected(502);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 502, code: "unexpected_response", message: en.sdk.errors.unexpected });
  });
});

describe("flowsOf", () => {
  it("keeps the flows that are objects, and answers none for anything that is not a list", () => {
    const pending = { id: "mfa_authenticate", is_pending: true };
    expect(flowsOf([{ id: "login" }, null, "provider_redirect", pending])).toEqual([{ id: "login" }, pending]);
    expect(flowsOf(undefined)).toEqual([]);
    expect(flowsOf({ id: "login" })).toEqual([]);
  });
});

describe("authenticatorOf", () => {
  it("answers an entry that has a type as it is", () => {
    const totp = { type: "totp", created_at: 1_700_000_000.5, last_used_at: null };
    expect(authenticatorOf(200, totp)).toBe(totp);
  });

  it("rejects, with the answer's status, an entry that is not an object or has no type as unexpected", () => {
    for (const data of [null, [], "totp", { created_at: 1 }, { type: 3 }]) {
      expect(thrown(() => authenticatorOf(201, data))).toMatchObject({ status: 201, code: "unexpected_response" });
    }
  });
});

describe("recoveryCodesOf", () => {
  it("answers the unused codes and both counts", () => {
    const data = { type: "recovery_codes", total_code_count: 10, unused_code_count: 2, unused_codes: ["a1b2", 3, "c3d4"] };
    expect(recoveryCodesOf(200, data)).toEqual({ unusedCodes: ["a1b2", "c3d4"], totalCodeCount: 10, unusedCodeCount: 2 });
  });

  it("answers no codes when allauth hides them", () => {
    expect(recoveryCodesOf(200, { total_code_count: 10, unused_code_count: 9 }).unusedCodes).toEqual([]);
    expect(recoveryCodesOf(200, { total_code_count: 10, unused_code_count: 9, unused_codes: "a1b2" }).unusedCodes).toEqual([]);
  });

  it("rejects, with the answer's status, an answer without both counts as unexpected", () => {
    const answers = [undefined, [], { total_code_count: 10 }, { unused_code_count: 2 }, { total_code_count: "10", unused_code_count: 2 }];
    for (const data of answers) {
      expect(thrown(() => recoveryCodesOf(200, data))).toMatchObject({ status: 200, code: "unexpected_response" });
    }
  });
});

describe("providerAccountsOf", () => {
  it("answers the linked accounts as they are", () => {
    const account = { uid: "1234", display: "Owner", provider: { id: "google", name: "Google", flows: ["provider_redirect"] } };
    expect(providerAccountsOf(200, [account])).toEqual([account]);
    expect(providerAccountsOf(200, [])).toEqual([]);
  });

  it("rejects, with the answer's status, a list that is not one or an entry without uid or provider id as unexpected", () => {
    const answers = [
      undefined,
      { uid: "1234" },
      [null],
      [{ provider: { id: "google" } }],
      [{ uid: 1234, provider: { id: "google" } }],
      [{ uid: "1234", provider: "google" }],
      [{ uid: "1234", provider: null }],
      [{ uid: "1234", provider: { name: "Google" } }],
    ];
    for (const data of answers) {
      expect(thrown(() => providerAccountsOf(200, data))).toMatchObject({ status: 200, code: "unexpected_response" });
    }
  });
});

describe("isReauthenticationRequired", () => {
  it("is true only for the reauthentication error, not for another 401", () => {
    expect(isReauthenticationRequired(new ReauthenticationRequiredError(["reauthenticate"]))).toBe(true);
    expect(isReauthenticationRequired(new ApiError(401, "not_authenticated", "Signed out"))).toBe(false);
    expect(isReauthenticationRequired(undefined)).toBe(false);
  });
});
