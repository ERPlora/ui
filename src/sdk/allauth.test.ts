import { afterEach, describe, expect, it } from "vitest";

import { CFG, headersOf, json, LOGGED_OUT_401, setup, USER } from "./__tests__/allauth-client";
import { ALLAUTH_BROWSER_BASE, createAllauthClient } from "./allauth";
import { ApiError } from "./errors";
import es from "./locales/es.json";

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

describe("createAllauthClient: what a person reads when the server did not word the failure", () => {
  afterEach(() => {
    document.documentElement.lang = "";
  });

  it("says, in the language of the page, that an answer that is not allauth's could not be completed", async () => {
    document.documentElement.lang = "es";
    const h = setup(() => new Response("<h1>Forbidden</h1>", { status: 403 }));
    await expect(h.client.login({ email: "a@b.c", password: "p" })).rejects.toMatchObject({
      status: 403,
      code: "unexpected_response",
      message: es.sdk.errors.unexpected,
    });
  });

  it("says the same for allauth's own answer without a message, keeping its code", async () => {
    document.documentElement.lang = "es";
    const h = setup(() => json(500, { status: 500 }));
    const err = (await h.client.login({ email: "a@b.c", password: "p" }).catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(500);
    expect(err.message).toBe(es.sdk.errors.unexpected);
  });

  it("says a request that never got an answer could not reach the server, and keeps why", async () => {
    document.documentElement.lang = "es";
    const h = setup(() => Promise.reject(new TypeError("Failed to fetch")));
    const err = (await h.client.login({ email: "a@b.c", password: "p" }).catch((e: unknown) => e)) as ApiError;
    expect(err).toMatchObject({ status: 0, code: "network_error", message: es.sdk.errors.network });
    expect(err.details).toEqual({ reason: "Failed to fetch" });
  });

  it("says a signed-out session has ended and to sign in again", async () => {
    document.documentElement.lang = "es";
    const h = setup(() => json(401, LOGGED_OUT_401));
    await expect(h.client.authenticators()).rejects.toMatchObject({
      status: 401,
      code: "not_authenticated",
      message: es.sdk.errors.signedOut,
    });
  });
});
