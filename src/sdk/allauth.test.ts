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

describe("createAllauthClient: signup", () => {
  // The «Create account» tab of the SaaS's launcher: allauth's own sign-up, never its login. allauth
  // answers a new address and one it already holds alike (enumeration prevention): the code mailed to
  // prove the address is pending.
  it("posts the email and password to …/auth/signup with the CSRF header and answers the pending code", async () => {
    const flows = [{ id: "login" }, { id: "verify_email", is_pending: true }];
    const h = setup(() => json(401, { status: 401, data: { flows }, meta: { is_authenticated: false } }));
    const state = await h.client.signup({ email: "new@example.com", password: "a long password" });
    expect(state).toEqual({ authenticated: false, flows, pendingFlow: "verify_email" });
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/signup");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ email: "new@example.com", password: "a long password" });
    expect(headersOf(h.last())).toEqual({
      "X-Device-Id": "dev-1",
      "X-CSRFToken": "tok",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
  });

  it("answers the signed-in user when no code is asked", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    expect(await h.client.signup({ email: "new@example.com", password: "p" })).toEqual({ authenticated: true, user: USER });
  });

  it("maps a refused password to the password field", async () => {
    const h = setup(() =>
      json(400, {
        status: 400,
        errors: [{ message: "This password is too short.", code: "password_too_short", param: "password" }],
      }),
    );
    await expect(h.client.signup({ email: "new@example.com", password: "123" })).rejects.toMatchObject({
      status: 400,
      code: "password_too_short",
      fields: { password: "This password is too short." },
    });
  });

  it("rejects the limit of sign-ups (429 without errors) with its status", async () => {
    const h = setup(() => json(429, { status: 429 }));
    await expect(h.client.signup({ email: "new@example.com", password: "p" })).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });

  it("rejects an already signed-in session (409) with a conflict", async () => {
    const h = setup(() => json(409, { status: 409 }));
    await expect(h.client.signup({ email: "new@example.com", password: "p" })).rejects.toMatchObject({
      status: 409,
      code: "conflict",
    });
  });

  it("rejects a request that never got an answer as a network error (status 0)", async () => {
    const h = setup(() => Promise.reject(new TypeError("Failed to fetch")));
    await expect(h.client.signup({ email: "new@example.com", password: "p" })).rejects.toMatchObject({
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

// --- The password, the linked provider accounts and the provider redirect ---

/** A linked Google account, as allauth.headless serialises it (`_socialaccount_data`). */
const GOOGLE = { id: "google", name: "Google", flows: ["provider_redirect"], client_id: "123.apps.googleusercontent.com" };
const GOOGLE_ACCOUNT = { uid: "1049", display: "Owner Example", provider: GOOGLE };

describe("createAllauthClient: password change", () => {
  it("posts the current and the new password to …/account/password/change and answers the session", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    const state = await h.client.changePassword({ current_password: "old-secret", new_password: "new-secret-42" });
    expect(state).toEqual({ authenticated: true, user: USER });
    expect(h.last().url).toBe("/_allauth/browser/v1/account/password/change");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ current_password: "old-secret", new_password: "new-secret-42" });
    expect(headersOf(h.last())).toEqual({
      "X-Device-Id": "dev-1",
      "X-CSRFToken": "tok",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
  });

  it("sends only the new password for an account that has none yet", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } }));
    await h.client.changePassword({ new_password: "new-secret-42" });
    expect(JSON.parse(h.last().init.body as string)).toEqual({ new_password: "new-secret-42" });
  });

  it("answers the signed-out state when the server ends the session on a password change", async () => {
    const h = setup(() => json(401, LOGGED_OUT_401));
    expect(await h.client.changePassword({ current_password: "a", new_password: "b" })).toEqual({
      authenticated: false,
      flows: [{ id: "login" }],
    });
  });

  it("maps a wrong current password and a weak new one to their fields", async () => {
    const h = setup(() =>
      json(400, {
        status: 400,
        errors: [
          { message: "Please type your current password.", code: "enter_current_password", param: "current_password" },
          { message: "This password is too common.", code: "password_too_common", param: "new_password" },
        ],
      }),
    );
    await expect(h.client.changePassword({ current_password: "x", new_password: "password" })).rejects.toMatchObject({
      status: 400,
      code: "enter_current_password",
      fields: { current_password: "Please type your current password.", new_password: "This password is too common." },
    });
  });

  it("puts a refusal without param (the SaaS's 403 for an account without a password) under __all__", async () => {
    const h = setup(() =>
      json(403, { status: 403, errors: [{ code: "password_required", message: "Your account has no password yet." }] }),
    );
    await expect(h.client.changePassword({ new_password: "new-secret-42" })).rejects.toMatchObject({
      status: 403,
      code: "password_required",
      fields: { __all__: "Your account has no password yet." },
    });
  });

  it("asks for a reauthentication when the change needs a recent login", async () => {
    const h = setup(() => json(401, REAUTH_401));
    await expectReauthenticationRequired(h.client.changePassword({ current_password: "a", new_password: "b" }));
  });
});

describe("createAllauthClient: linked provider accounts", () => {
  it("reads them with GET …/account/providers", async () => {
    const h = setup(() => json(200, { status: 200, data: [GOOGLE_ACCOUNT] }));
    expect(await h.client.providerAccounts()).toEqual([GOOGLE_ACCOUNT]);
    expect(h.last().url).toBe("/_allauth/browser/v1/account/providers");
    expect(h.last().init.method).toBe("GET");
    expect(h.last().init.body).toBeUndefined();
    expect(headersOf(h.last())).toEqual({ "X-Device-Id": "dev-1", Accept: "application/json" });
  });

  it("answers an empty list when nothing is linked", async () => {
    const h = setup(() => json(200, { status: 200, data: [] }));
    expect(await h.client.providerAccounts()).toEqual([]);
  });

  it("rejects a 200 whose data is not a list, or an entry without uid or provider, as unexpected", async () => {
    for (const data of [{ uid: "1" }, [{ display: "x", provider: GOOGLE }], [{ uid: "1", display: "x", provider: "google" }]]) {
      const h = setup(() => json(200, { status: 200, data }));
      await expect(h.client.providerAccounts(), JSON.stringify(data)).rejects.toMatchObject({
        status: 200,
        code: "unexpected_response",
      });
    }
  });

  it("rejects a signed-out session with a plain 401", async () => {
    const h = setup(() => json(401, LOGGED_OUT_401));
    await expect(h.client.providerAccounts()).rejects.toMatchObject({ status: 401, code: "not_authenticated" });
  });

  it("disconnects one with DELETE {provider, account} and the CSRF header, answering the accounts left", async () => {
    const h = setup(() => json(200, { status: 200, data: [] }));
    expect(await h.client.disconnectProvider("google", "1049")).toEqual([]);
    expect(h.last().url).toBe("/_allauth/browser/v1/account/providers");
    expect(h.last().init.method).toBe("DELETE");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ provider: "google", account: "1049" });
    expect(headersOf(h.last())).toEqual({
      "X-Device-Id": "dev-1",
      "X-CSRFToken": "tok",
      Accept: "application/json",
      "Content-Type": "application/json",
    });
  });

  it("maps a disconnect that would lock the account out (no password) to the account field", async () => {
    const h = setup(() =>
      json(400, { status: 400, errors: [{ message: "Your account has no password set up.", code: "no_password", param: "account" }] }),
    );
    await expect(h.client.disconnectProvider("google", "1049")).rejects.toMatchObject({
      status: 400,
      code: "no_password",
      fields: { account: "Your account has no password set up." },
    });
  });

  it("asks for a reauthentication before disconnecting", async () => {
    const h = setup(() => json(401, REAUTH_401));
    await expectReauthenticationRequired(h.client.disconnectProvider("google", "1049"));
  });
});

describe("createAllauthClient: the provider redirect (a synchronous form post, never fetch)", () => {
  it("builds the form of …/auth/provider/redirect with the CSRF token of the cookie", () => {
    const h = setup(() => json(200, {}));
    expect(h.client.providerRedirectForm({ provider: "google", callbackUrl: "/account/security", process: "login" })).toEqual({
      action: "/_allauth/browser/v1/auth/provider/redirect",
      method: "post",
      fields: {
        provider: "google",
        callback_url: "/account/security",
        process: "login",
        csrfmiddlewaretoken: "from-cookie",
      },
    });
    expect(h.calls).toHaveLength(0);
  });

  it("links another account with `connect`", () => {
    const h = setup(() => json(200, {}));
    expect(h.client.providerRedirectForm({ provider: "google", callbackUrl: "/account/connections", process: "connect" }).fields).toMatchObject({
      process: "connect",
      callback_url: "/account/connections",
    });
  });

  it("leaves the token empty without a CSRF cookie (Django then refuses the post)", () => {
    const h = setup(() => json(200, {}), { cookies: () => "" });
    expect(h.client.providerRedirectForm({ provider: "google", callbackUrl: "/", process: "login" }).fields.csrfmiddlewaretoken).toBe("");
  });
});

// --- Email verification of a login or sign-up, and the password reset by link ---

const SIGNED_IN_200 = { status: 200, data: { user: USER, methods: [] }, meta: { is_authenticated: true } };

describe("createAllauthClient: the email verification step of a login or sign-up", () => {
  it("posts the mailed code as allauth's `key` to …/auth/email/verify and answers the signed-in user", async () => {
    const h = setup(() => json(200, SIGNED_IN_200));
    expect(await h.client.verifyEmail("123456")).toEqual({ authenticated: true, user: USER });
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/email/verify");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ key: "123456" });
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
  });

  it("answers a further pending step (the account's 2FA) as the anonymous state", async () => {
    const flows = [{ id: "login" }, { id: "mfa_authenticate", is_pending: true, types: ["totp"] }];
    const h = setup(() => json(401, { status: 401, data: { flows }, meta: { is_authenticated: false } }));
    expect(await h.client.verifyEmail("123456")).toEqual({ authenticated: false, flows, pendingFlow: "mfa_authenticate" });
  });

  it("maps a wrong or expired code to the key field", async () => {
    const h = setup(() => json(400, { status: 400, errors: [{ message: "Incorrect code.", code: "incorrect_code", param: "key" }] }));
    await expect(h.client.verifyEmail("000000")).rejects.toMatchObject({
      status: 400,
      code: "incorrect_code",
      fields: { key: "Incorrect code." },
    });
  });

  it("rejects with a conflict when no verification is pending (409)", async () => {
    const h = setup(() => json(409, { status: 409 }));
    await expect(h.client.verifyEmail("123456")).rejects.toMatchObject({ status: 409, code: "conflict" });
  });

  it("asks for a new code with a body-less POST to …/auth/email/verify/resend and the CSRF header", async () => {
    const h = setup(() => json(200, { status: 200 }));
    await expect(h.client.resendEmailVerification()).resolves.toBeUndefined();
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/email/verify/resend");
    expect(h.last().init.method).toBe("POST");
    expect(h.last().init.body).toBeUndefined();
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
  });

  it("rejects a new code with a conflict when none can be sent (409) and with too_many_requests on a 429", async () => {
    await expect(setup(() => json(409, { status: 409 })).client.resendEmailVerification()).rejects.toMatchObject({
      status: 409,
      code: "conflict",
    });
    await expect(setup(() => json(429, { status: 429 })).client.resendEmailVerification()).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });
});

describe("createAllauthClient: the code mailed at every password sign-in (`login_by_code`)", () => {
  it("posts the code to …/auth/code/confirm and answers the signed-in user", async () => {
    const h = setup(() => json(200, SIGNED_IN_200));
    expect(await h.client.confirmLoginCode("482913")).toEqual({ authenticated: true, user: USER });
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/code/confirm");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ code: "482913" });
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
  });

  it("answers a further pending step (the authenticator app) as the anonymous state", async () => {
    const flows = [{ id: "login" }, { id: "mfa_authenticate", is_pending: true, types: ["totp"] }];
    const h = setup(() => json(401, { status: 401, data: { flows }, meta: { is_authenticated: false } }));
    expect(await h.client.confirmLoginCode("482913")).toEqual({ authenticated: false, flows, pendingFlow: "mfa_authenticate" });
  });

  it("maps a wrong code to the code field", async () => {
    const h = setup(() => json(400, { status: 400, errors: [{ message: "Incorrect code.", code: "incorrect_code", param: "code" }] }));
    await expect(h.client.confirmLoginCode("000000")).rejects.toMatchObject({
      status: 400,
      code: "incorrect_code",
      fields: { code: "Incorrect code." },
    });
  });

  it("rejects with a conflict when no sign-in waits for a code (expired, or too many wrong ones: 409)", async () => {
    const h = setup(() => json(409, { status: 409 }));
    await expect(h.client.confirmLoginCode("482913")).rejects.toMatchObject({ status: 409, code: "conflict" });
  });
});

describe("createAllauthClient: the password reset by link", () => {
  it("asks for the link with POST {email} to …/auth/password/request and the CSRF header", async () => {
    const h = setup(() => json(200, { status: 200 }));
    await expect(h.client.requestPasswordReset("owner@example.com")).resolves.toBeUndefined();
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/password/request");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ email: "owner@example.com" });
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
  });

  it("maps an invalid address to the email field, and rejects a 429 with too_many_requests", async () => {
    const invalid = setup(() =>
      json(400, { status: 400, errors: [{ message: "Enter a valid email address.", code: "invalid", param: "email" }] }),
    );
    await expect(invalid.client.requestPasswordReset("nope")).rejects.toMatchObject({
      status: 400,
      fields: { email: "Enter a valid email address." },
    });
    await expect(setup(() => json(429, { status: 429 })).client.requestPasswordReset("a@b.c")).rejects.toMatchObject({
      status: 429,
      code: "too_many_requests",
    });
  });

  it("checks the link's key with GET …/auth/password/reset and the X-Password-Reset-Key header, answering its account", async () => {
    const h = setup(() => json(200, { status: 200, data: { user: USER } }));
    expect(await h.client.passwordResetKeyInfo("1-abc-def")).toEqual(USER);
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/password/reset");
    expect(h.last().init.method).toBe("GET");
    expect(h.last().init.body).toBeUndefined();
    expect(headersOf(h.last())).toEqual({
      "X-Device-Id": "dev-1",
      Accept: "application/json",
      "X-Password-Reset-Key": "1-abc-def",
    });
  });

  it("maps an invalid or used key to the key field", async () => {
    const h = setup(() =>
      json(400, { status: 400, errors: [{ message: "The password reset token was invalid.", code: "token_invalid", param: "key" }] }),
    );
    await expect(h.client.passwordResetKeyInfo("1-bad")).rejects.toMatchObject({
      status: 400,
      fields: { key: "The password reset token was invalid." },
    });
  });

  it("rejects a key answer without the account as unexpected", async () => {
    const h = setup(() => json(200, { status: 200, data: {} }));
    await expect(h.client.passwordResetKeyInfo("1-abc")).rejects.toMatchObject({ code: "unexpected_response" });
  });

  it("sets the new password with POST {key, password} to …/auth/password/reset, signed in on a 200", async () => {
    const h = setup(() => json(200, SIGNED_IN_200));
    expect(await h.client.resetPassword("1-abc-def", "a new long password")).toEqual({ authenticated: true, user: USER });
    expect(h.last().url).toBe("/_allauth/browser/v1/auth/password/reset");
    expect(h.last().init.method).toBe("POST");
    expect(JSON.parse(h.last().init.body as string)).toEqual({ key: "1-abc-def", password: "a new long password" });
    expect(headersOf(h.last())["X-CSRFToken"]).toBe("tok");
    expect(headersOf(h.last())).not.toHaveProperty("X-Password-Reset-Key");
  });

  it("answers the anonymous state when the person signs in afterwards (401)", async () => {
    const h = setup(() => json(401, LOGGED_OUT_401));
    expect(await h.client.resetPassword("1-abc", "a new long password")).toEqual({ authenticated: false, flows: [{ id: "login" }] });
  });

  it("maps the password validators' messages to the password field, and a used key to the key field", async () => {
    const weak = setup(() =>
      json(400, {
        status: 400,
        errors: [
          { message: "This password is too short.", code: "password_too_short", param: "password" },
          { message: "This password is too common.", code: "password_too_common", param: "password" },
        ],
      }),
    );
    await expect(weak.client.resetPassword("1-abc", "abc")).rejects.toMatchObject({
      status: 400,
      fields: { password: "This password is too short. This password is too common." },
    });
    const used = setup(() =>
      json(400, { status: 400, errors: [{ message: "The password reset token was invalid.", code: "token_invalid", param: "key" }] }),
    );
    await expect(used.client.resetPassword("1-abc", "a new long password")).rejects.toMatchObject({
      fields: { key: "The password reset token was invalid." },
    });
  });
});
