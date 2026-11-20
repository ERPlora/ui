import { describe, expect, it } from "vitest";

import { headersOf, json, LOGGED_OUT_401, setup, USER } from "./__tests__/allauth-client";

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
