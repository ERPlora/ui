import { describe, expect, it } from "vitest";

import {
  expectReauthenticationRequired,
  headersOf,
  json,
  LOGGED_OUT_401,
  REAUTH_401,
  setup,
  USER,
} from "./__tests__/allauth-client";
import { isReauthenticationRequired } from "./allauth-replies";
import { ApiError } from "./errors";

const TOTP = { type: "totp", created_at: 1760000000.5, last_used_at: null };
const RECOVERY = { type: "recovery_codes", created_at: 1760000001, last_used_at: null, total_code_count: 10, unused_code_count: 9 };
const CODES = ["a1b2c3d4", "e5f6g7h8"];
const WRONG_CODE_400 = {
  status: 400,
  errors: [{ message: "Incorrect code.", code: "incorrect_code", param: "code" }],
};

describe("createAllauthClient: the list of authenticators", () => {
  it("reads them with GET …/account/authenticators", async () => {
    const h = setup(() => json(200, { status: 200, data: [TOTP, RECOVERY] }));
    expect(await h.client.authenticators()).toEqual([TOTP, RECOVERY]);
    expect(h.last().url).toBe("/_allauth/browser/v1/account/authenticators");
    expect(h.last().init.method).toBe("GET");
    expect(h.last().init.credentials).toBe("same-origin");
    expect(h.last().init.body).toBeUndefined();
    expect(headersOf(h.last())).toEqual({ "X-Device-Id": "dev-1", Accept: "application/json" });
  });

  it("rejects with status 404 when the server has 2FA switched off (JSON 404)", async () => {
    const h = setup(() => json(404, { status: 404 }));
    const failure = h.client.authenticators();
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("keeps the status 404 of a non-JSON 404 (Django's HTML page of an unknown route)", async () => {
    const h = setup(() => new Response("<h1>Not Found</h1>", { status: 404 }));
    await expect(h.client.authenticators()).rejects.toMatchObject({ status: 404, code: "unexpected_response" });
  });

  it("rejects a signed-out session with a plain 401, not a reauthentication", async () => {
    const h = setup(() => json(401, LOGGED_OUT_401));
    const err = await h.client.authenticators().catch((reason: unknown) => reason);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: "not_authenticated" });
    expect(isReauthenticationRequired(err)).toBe(false);
  });

  it("rejects a 200 whose data is not a list as unexpected", async () => {
    const h = setup(() => json(200, { status: 200, data: { type: "totp" } }));
    await expect(h.client.authenticators()).rejects.toMatchObject({ status: 200, code: "unexpected_response" });
  });

  it("rejects a request that never got an answer as a network error (status 0)", async () => {
    const h = setup(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(h.client.authenticators()).rejects.toMatchObject({ status: 0, code: "network_error" });
  });
});

describe("createAllauthClient: TOTP", () => {
  it("reports an active authenticator on a 200 of GET …/authenticators/totp", async () => {
    const h = setup(() => json(200, { status: 200, data: TOTP }));
    expect(await h.client.totpActivateGet()).toEqual({ active: true, authenticator: TOTP });
    expect(h.last().url).toBe("/_allauth/browser/v1/account/authenticators/totp");
    expect(h.last().init.method).toBe("GET");
  });

  it("maps the 404 with the new secret to the setup (the QR encodes totp_url)", async () => {
    const totpUrl = "otpauth://totp/ERPlora:owner%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=ERPlora";
    const h = setup(() => json(404, { status: 404, meta: { secret: "JBSWY3DPEHPK3PXP", totp_url: totpUrl } }));
    expect(await h.client.totpActivateGet()).toEqual({
      active: false,
      setup: { secret: "JBSWY3DPEHPK3PXP", totpUrl },
    });
  });

  it("rejects a 404 without the secret (TOTP not offered) with status 404", async () => {
    const h = setup(() => json(404, { status: 404 }));
    await expect(h.client.totpActivateGet()).rejects.toMatchObject({ status: 404, code: "not_found" });
  });

  it("rejects the setup when the account cannot add an authenticator (409, e.g. unverified email)", async () => {
    const h = setup(() =>
      json(409, { status: 409, errors: [{ message: "You cannot activate two-factor authentication until you have verified your email address.", code: "unverified_email" }] }),
    );
    await expect(h.client.totpActivateGet()).rejects.toMatchObject({
      status: 409,
      code: "unverified_email",
      fields: { __all__: "You cannot activate two-factor authentication until you have verified your email address." },
    });
  });

  it("activates with POST {code} and the CSRF header, answering the new authenticator", async () => {
    const h = setup(() => json(200, { status: 200, data: TOTP }));
    expect(await h.client.totpActivatePost("123456")).toEqual(TOTP);
    expect(h.last().url).toBe("/_allauth/browser/v1/account/authenticators/totp");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ code: "123456" });
    expect(headersOf(h.last())).toEqual({
      "X-Device-Id": "dev-1",
      "X-CSRFToken": "tok",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
  });

  it("maps a wrong code to the code field", async () => {
    const h = setup(() => json(400, WRONG_CODE_400));
    await expect(h.client.totpActivatePost("000000")).rejects.toMatchObject({
      status: 400,
      code: "incorrect_code",
      fields: { code: "Incorrect code." },
    });
  });

  it("asks for a reauthentication when the activation needs a recent login", async () => {
    const h = setup(() => json(401, REAUTH_401));
    await expectReauthenticationRequired(h.client.totpActivatePost("123456"));
  });

  it("rejects an activation answer without an authenticator as unexpected", async () => {
    const h = setup(() => json(200, { status: 200 }));
    await expect(h.client.totpActivatePost("123456")).rejects.toMatchObject({ code: "unexpected_response" });
  });

  it("deactivates with DELETE and the CSRF header", async () => {
    const h = setup(() => json(200, { status: 200 }));
    await expect(h.client.totpDeactivate()).resolves.toBeUndefined();
    expect(h.last().url).toBe("/_allauth/browser/v1/account/authenticators/totp");
    expect(h.last().init.method).toBe("DELETE");
    expect(h.last().init.body).toBeUndefined();
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
  });

  it("asks for a reauthentication before deactivating", async () => {
    const h = setup(() => json(401, REAUTH_401));
    await expectReauthenticationRequired(h.client.totpDeactivate());
  });
});

describe("createAllauthClient: recovery codes", () => {
  it("reads them with GET …/authenticators/recovery-codes", async () => {
    const h = setup(() => json(200, { status: 200, data: { ...RECOVERY, unused_codes: CODES } }));
    expect(await h.client.recoveryCodesGet()).toEqual({ unusedCodes: CODES, totalCodeCount: 10, unusedCodeCount: 9 });
    expect(h.last().url).toBe("/_allauth/browser/v1/account/authenticators/recovery-codes");
    expect(h.last().init.method).toBe("GET");
  });

  it("answers no codes as an empty list when allauth hides them (shown once already)", async () => {
    const h = setup(() => json(200, { status: 200, data: RECOVERY }));
    expect(await h.client.recoveryCodesGet()).toEqual({ unusedCodes: [], totalCodeCount: 10, unusedCodeCount: 9 });
  });

  it("answers null on a 404: the account has no recovery codes", async () => {
    const h = setup(() => json(404, { status: 404 }));
    expect(await h.client.recoveryCodesGet()).toBeNull();
  });

  it("asks for a reauthentication before showing them", async () => {
    const h = setup(() => json(401, REAUTH_401));
    await expectReauthenticationRequired(h.client.recoveryCodesGet());
  });

  it("rejects codes without their counts as unexpected", async () => {
    const h = setup(() => json(200, { status: 200, data: { type: "recovery_codes", unused_codes: CODES } }));
    await expect(h.client.recoveryCodesGet()).rejects.toMatchObject({ status: 200, code: "unexpected_response" });
  });

  it("regenerates them with a body-less POST and the CSRF header", async () => {
    const h = setup(() => json(200, { status: 200, data: { ...RECOVERY, unused_code_count: 10, unused_codes: CODES } }));
    expect(await h.client.recoveryCodesRegenerate()).toEqual({ unusedCodes: CODES, totalCodeCount: 10, unusedCodeCount: 10 });
    expect(h.last().url).toBe("/_allauth/browser/v1/account/authenticators/recovery-codes");
    expect(h.last().init.method).toBe("POST");
    expect(h.last().init.body).toBeUndefined();
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
    expect(headersOf(h.last())).not.toHaveProperty("Content-Type");
  });

  it("puts a refusal without param (no other authenticator) under __all__", async () => {
    const h = setup(() =>
      json(400, { status: 400, errors: [{ message: "You cannot generate recovery codes.", code: "cannot_generate_recovery_codes" }] }),
    );
    await expect(h.client.recoveryCodesRegenerate()).rejects.toMatchObject({
      status: 400,
      code: "cannot_generate_recovery_codes",
      fields: { __all__: "You cannot generate recovery codes." },
    });
  });

  it("asks for a reauthentication before regenerating them", async () => {
    const h = setup(() => json(401, REAUTH_401));
    await expectReauthenticationRequired(h.client.recoveryCodesRegenerate());
  });
});

describe("createAllauthClient: the 2FA step of a login", () => {
  it("posts the code to …/auth/2fa/authenticate and answers the signed-in user", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    expect(await h.client.mfaAuthenticate("123456")).toEqual({ authenticated: true, user: USER });
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/2fa/authenticate");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ code: "123456" });
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
  });

  it("answers a further pending step (trust this browser) as the anonymous state", async () => {
    const flows = [{ id: "login" }, { id: "mfa_trust", is_pending: true }];
    const h = setup(() => json(401, { status: 401, data: { flows }, meta: { is_authenticated: false } }));
    expect(await h.client.mfaAuthenticate("123456")).toEqual({ authenticated: false, flows, pendingFlow: "mfa_trust" });
  });

  it("maps a wrong code to the code field", async () => {
    const h = setup(() => json(400, WRONG_CODE_400));
    await expect(h.client.mfaAuthenticate("000000")).rejects.toMatchObject({
      status: 400,
      fields: { code: "Incorrect code." },
    });
  });

  it("rejects with a conflict when no login is pending (409)", async () => {
    const h = setup(() => json(409, { status: 409 }));
    await expect(h.client.mfaAuthenticate("123456")).rejects.toMatchObject({ status: 409, code: "conflict" });
  });
});

describe("createAllauthClient: «Trust this browser» after the 2FA step", () => {
  it("posts the answer to …/auth/2fa/trust with the CSRF token and answers the signed-in user", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    expect(await h.client.mfaTrust(true)).toEqual({ authenticated: true, user: USER });
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/2fa/trust");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ trust: true });
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
    expect(headersOf(h.last())["Content-Type"]).toBe("application/json");
  });

  it("sends «not now» as trust: false", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    await h.client.mfaTrust(false);
    expect(JSON.parse(h.last().init.body as string)).toEqual({ trust: false });
  });

  it("answers a login that still waits for another step as the anonymous state", async () => {
    const flows = [{ id: "login" }, { id: "mfa_trust", is_pending: true }];
    const h = setup(() => json(401, { status: 401, data: { flows }, meta: { is_authenticated: false } }));
    expect(await h.client.mfaTrust(true)).toEqual({ authenticated: false, flows, pendingFlow: "mfa_trust" });
  });

  it("when no login waits for the question (none, too early, or another tab already answered) answers the anonymous state: allauth sends a 401 without a pending flow, never a 409", async () => {
    const flows = [{ id: "login" }, { id: "signup" }];
    const h = setup(() => json(401, { status: 401, data: { flows }, meta: { is_authenticated: null } }));
    expect(await h.client.mfaTrust(true)).toEqual({ authenticated: false, flows });
  });

  it("a 409 rejects with a conflict, like every call", async () => {
    const h = setup(() => json(409, { status: 409 }));
    await expect(h.client.mfaTrust(true)).rejects.toMatchObject({ status: 409, code: "conflict" });
  });
});

describe("createAllauthClient: reauthentication", () => {
  it("confirms the password with POST …/auth/reauthenticate", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    await expect(h.client.reauthenticate("owner")).resolves.toBeUndefined();
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/reauthenticate");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ password: "owner" });
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
  });

  it("maps a wrong password to the password field", async () => {
    const h = setup(() =>
      json(400, { status: 400, errors: [{ message: "Incorrect password.", code: "incorrect_password", param: "password" }] }),
    );
    await expect(h.client.reauthenticate("nope")).rejects.toMatchObject({
      status: 400,
      fields: { password: "Incorrect password." },
    });
  });

  it("confirms a TOTP or recovery code with POST …/auth/2fa/reauthenticate", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    await expect(h.client.mfaReauthenticate("a1b2c3d4")).resolves.toBeUndefined();
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/2fa/reauthenticate");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ code: "a1b2c3d4" });
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
  });

  it("maps a wrong 2FA code to the code field", async () => {
    const h = setup(() => json(400, WRONG_CODE_400));
    await expect(h.client.mfaReauthenticate("000000")).rejects.toMatchObject({ fields: { code: "Incorrect code." } });
  });

  it("rejects a signed-out session with a plain 401", async () => {
    const h = setup(() => json(401, LOGGED_OUT_401));
    await expect(h.client.reauthenticate("owner")).rejects.toMatchObject({ status: 401, code: "not_authenticated" });
  });
});
