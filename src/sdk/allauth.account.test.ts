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
