import { expect } from "vitest";

import { type AllauthDeps, createAllauthClient } from "../allauth";
import { isReauthenticationRequired, ReauthenticationRequiredError } from "../allauth-replies";
import { ApiError } from "../errors";

export const CFG = { csrfCookieName: "csrftoken", csrfHeader: "X-CSRFToken", deviceIdStorageKey: "erplora.device_id" };
export const USER = { id: 7, email: "owner@example.com", display: "Owner", has_usable_password: true };

interface Recorded {
  url: string;
  init: RequestInit;
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function setup(respond: () => Response | Promise<Response>, overrides: Partial<AllauthDeps> = {}) {
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

export const headersOf = (rec: Recorded) => rec.init.headers as Record<string, string>;

/** allauth's answer to a protected account call while the recent login is too old. */
export const REAUTH_401 = {
  status: 401,
  data: {
    user: USER,
    methods: [],
    flows: [{ id: "reauthenticate" }, { id: "mfa_reauthenticate", types: ["totp", "recovery_codes"] }],
  },
  meta: { is_authenticated: true },
};
export const LOGGED_OUT_401 = { status: 401, data: { flows: [{ id: "login" }] }, meta: { is_authenticated: false } };

export async function expectReauthenticationRequired(call: Promise<unknown>) {
  const err = await call.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toBeInstanceOf(ReauthenticationRequiredError);
  expect(isReauthenticationRequired(err)).toBe(true);
  expect(err).toMatchObject({ status: 401, code: "reauthentication_required", flows: ["reauthenticate", "mfa_reauthenticate"] });
}
