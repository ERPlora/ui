// The SDK's client of allauth.headless (browser client, `/_allauth/browser/v1`), used by the SaaS's
// account pages. Same-origin session cookie + Django's CSRF token from the header provider; allauth's
// `errors[{param, code, message}]` become the SDK's `ApiError` with `fields` per input (an error
// without `param` goes under `__all__`, as in Django forms); a 401 is not an error but the anonymous
// state, with the `flows` the visitor can take (a pending one: a further step of the login).
import { describe, expect, it } from "vitest";

import {
  ALLAUTH_BROWSER_BASE,
  type AllauthDeps,
  createAllauthClient,
  isReauthenticationRequired,
  ReauthenticationRequiredError,
} from "./allauth";
import { ApiError } from "./errors";

const CFG = { csrfCookieName: "csrftoken", csrfHeader: "X-CSRFToken", deviceIdStorageKey: "erplora.device_id" };
const USER = { id: 7, email: "owner@example.com", display: "Owner", has_usable_password: true };

interface Recorded {
  url: string;
  init: RequestInit;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setup(respond: () => Response | Promise<Response>, overrides: Partial<AllauthDeps> = {}) {
  const calls: Recorded[] = [];
  const client = createAllauthClient(CFG, {
    fetchImpl: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(respond());
    },
    headers: {
      apiHeaders: (method) => ({
        "X-Device-Id": "dev-1",
        ...(method.toUpperCase() === "GET" ? {} : { "X-CSRFToken": "tok" }),
      }),
    },
    cookies: () => "other=1; csrftoken=from-cookie",
    ...overrides,
  });
  return { client, calls, last: () => calls.at(-1) as Recorded };
}

const headersOf = (rec: Recorded) => rec.init.headers as Record<string, string>;

describe("createAllauthClient: the session", () => {
  it("reads it with GET /_allauth/browser/v1/auth/session, same origin", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    expect(await h.client.getSession()).toEqual({ authenticated: true, user: USER });
    expect(ALLAUTH_BROWSER_BASE).toBe("/_allauth/browser/v1");
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/session");
    expect(h.last().init.method).toBe("GET");
    expect(h.last().init.credentials).toBe("same-origin");
    expect(h.last().init.body).toBeUndefined();
    expect(headersOf(h.last())).toEqual({ "X-Device-Id": "dev-1", Accept: "application/json" });
  });

  it("answers the anonymous state with its flows on a 401: not an error", async () => {
    const flows = [{ id: "login" }, { id: "provider_redirect", providers: ["google"] }];
    const h = setup(() => json(401, { status: 401, data: { flows }, meta: { is_authenticated: false } }));
    expect(await h.client.getSession()).toEqual({ authenticated: false, flows });
  });

  it("names the pending step of a login in progress (the 2FA page resumes it after a reload)", async () => {
    const flows = [{ id: "login" }, { id: "mfa_authenticate", is_pending: true, types: ["totp"] }];
    const h = setup(() => json(401, { status: 401, data: { flows }, meta: { is_authenticated: false } }));
    expect(await h.client.getSession()).toEqual({ authenticated: false, flows, pendingFlow: "mfa_authenticate" });
  });
});

describe("createAllauthClient: login", () => {
  it("posts the credentials as JSON with the CSRF header and answers the signed-in user", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    const state = await h.client.login({ email: "owner@example.com", password: "owner" });
    expect(state).toEqual({ authenticated: true, user: USER });
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/login");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ email: "owner@example.com", password: "owner" });
    expect(headersOf(h.last())).toEqual({
      "X-Device-Id": "dev-1",
      "X-CSRFToken": "tok",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
  });

  it("maps allauth's errors to field errors by param, the rest under __all__", async () => {
    const h = setup(() =>
      json(400, {
        status: 400,
        errors: [
          { message: "Enter a valid email address.", code: "invalid", param: "email" },
          { message: "Too many failed login attempts.", code: "too_many_login_attempts" },
        ],
      }),
    );
    const failure = h.client.login({ email: "x", password: "y" });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({
      status: 400,
      code: "invalid",
      message: "Enter a valid email address.",
      fields: { email: "Enter a valid email address.", __all__: "Too many failed login attempts." },
    });
  });

  it("joins several errors of one field", async () => {
    const h = setup(() =>
      json(400, {
        status: 400,
        errors: [
          { message: "This field is required.", code: "required", param: "password" },
          { message: "Too short.", code: "short", param: "password" },
        ],
      }),
    );
    await expect(h.client.login({ email: "a@b.c", password: "" })).rejects.toMatchObject({
      fields: { password: "This field is required. Too short." },
    });
  });

  it("answers a login that needs another step (2FA, email verification) with the pending flow", async () => {
    const flows = [{ id: "login" }, { id: "mfa_authenticate", is_pending: true, types: ["totp", "recovery_codes"] }];
    const h = setup(() => json(401, { status: 401, data: { flows }, meta: { is_authenticated: false } }));
    expect(await h.client.login({ email: "a@b.c", password: "p" })).toEqual({
      authenticated: false,
      flows,
      pendingFlow: "mfa_authenticate",
    });
  });

  it("leaves pendingFlow out when no flow is pending", async () => {
    const h = setup(() => json(401, { status: 401, data: { flows: [{ id: "login" }] }, meta: { is_authenticated: false } }));
    expect(await h.client.login({ email: "a@b.c", password: "p" })).not.toHaveProperty("pendingFlow");
  });

  it("rejects an already signed-in session (409) with a conflict", async () => {
    const h = setup(() => json(409, { status: 409 }));
    await expect(h.client.login({ email: "a@b.c", password: "p" })).rejects.toMatchObject({
      status: 409,
      code: "conflict",
    });
  });

  it("rejects a non-JSON answer (Django's HTML 403 of a missing CSRF token) as unexpected", async () => {
    const h = setup(() => new Response("<h1>Forbidden</h1>", { status: 403 }));
    await expect(h.client.login({ email: "a@b.c", password: "p" })).rejects.toMatchObject({
      status: 403,
      code: "unexpected_response",
      fields: undefined,
    });
  });

  it("rejects a request that never got an answer as a network error (status 0)", async () => {
    const h = setup(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(h.client.login({ email: "a@b.c", password: "p" })).rejects.toMatchObject({
      status: 0,
      code: "network_error",
    });
  });
});

describe("createAllauthClient: logout and plain forms", () => {
  it("signs out with DELETE …/auth/session and the CSRF header: the 401 that follows is success", async () => {
    const h = setup(() => json(401, { status: 401, data: { flows: [{ id: "login" }] }, meta: { is_authenticated: false } }));
    expect(await h.client.logout()).toEqual({ authenticated: false, flows: [{ id: "login" }] });
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/session");
    expect(h.last().init.method).toBe("DELETE");
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
  });

  it("hands the CSRF token to a plain form post (the Google button posts to a Django route)", () => {
    expect(setup(() => json(200, {})).client.csrfToken()).toBe("from-cookie");
    expect(setup(() => json(200, {}), { cookies: () => "" }).client.csrfToken()).toBeUndefined();
  });

  it("builds its browser defaults from the SPA config alone", () => {
    document.cookie = "csrftoken=browser-token";
    expect(createAllauthClient(CFG).csrfToken()).toBe("browser-token");
  });
});

// --- Two-factor authentication (allauth.mfa through allauth.headless) ---

const TOTP = { type: "totp", created_at: 1760000000.5, last_used_at: null };
const RECOVERY = { type: "recovery_codes", created_at: 1760000001, last_used_at: null, total_code_count: 10, unused_code_count: 9 };
const CODES = ["a1b2c3d4", "e5f6g7h8"];
/** allauth's answer to a protected account call while the recent login is too old. */
const REAUTH_401 = {
  status: 401,
  data: {
    user: USER,
    methods: [],
    flows: [{ id: "reauthenticate" }, { id: "mfa_reauthenticate", types: ["totp", "recovery_codes"] }],
  },
  meta: { is_authenticated: true },
};
const LOGGED_OUT_401 = { status: 401, data: { flows: [{ id: "login" }] }, meta: { is_authenticated: false } };
const WRONG_CODE_400 = {
  status: 400,
  errors: [{ message: "Incorrect code.", code: "incorrect_code", param: "code" }],
};

async function expectReauthenticationRequired(call: Promise<unknown>) {
  const err = await call.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toBeInstanceOf(ReauthenticationRequiredError);
  expect(isReauthenticationRequired(err)).toBe(true);
  expect(err).toMatchObject({ status: 401, code: "reauthentication_required", flows: ["reauthenticate", "mfa_reauthenticate"] });
}

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

describe("ReauthenticationRequiredError", () => {
  it("is an ApiError with status 401, its own code and the ids of the flows that confirm it", () => {
    const err = new ReauthenticationRequiredError(["reauthenticate"]);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: "reauthentication_required", flows: ["reauthenticate"] });
    expect(err.name).toBe("ReauthenticationRequiredError");
    expect(isReauthenticationRequired(err)).toBe(true);
    expect(isReauthenticationRequired(new ApiError(401, "not_authenticated", "Login"))).toBe(false);
    expect(isReauthenticationRequired(new Error("x"))).toBe(false);
  });
});
