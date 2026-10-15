/**
 * Client of allauth.headless's browser API (`/_allauth/browser/v1`), for the SaaS's account pages.
 * Only transport: the session, the password login and the sign-up (two calls, `login` for allauth's
 * login and `signup` for allauth's sign-up; whether either may create or open an account is allauth's
 * and the SaaS's decision), the code steps that follow (the email verification of a sign-up, the code
 * mailed at every password sign-in), the logout, the password reset by link, two-factor
 * authentication (the login's 2FA step, TOTP, recovery codes and reauthentication), the password
 * change and the linked provider accounts; allauth decides everything.
 *
 * - Same-origin session cookie; unsafe methods carry Django's CSRF token from the header provider
 *   (the SPA's HTML sets the cookie, and so does `GET …/auth/session`).
 * - A 200 is the signed-in user. A 401 is not an error: it is the anonymous state, with the `flows`
 *   the visitor can take; a login that needs another step (2FA, email verification) answers it with
 *   that flow `is_pending` (named in `pendingFlow`).
 * - A 401 of a signed-in user (`meta.is_authenticated`) is not the anonymous state: a protected
 *   account call needs a recent login, and it rejects with `ReauthenticationRequiredError`.
 * - Account calls (`/account/…`) answer data: a 401 of a signed-out session rejects with
 *   `not_authenticated`; a 404 is "none yet" only where the method says so (TOTP setup, recovery
 *   codes) and otherwise rejects with status 404 (2FA switched off on the server).
 * - Anything else rejects with the SDK's `ApiError`: allauth's `errors[{param, code, message}]`
 *   become `fields` per input (an error without `param` under `__all__`, as in Django forms),
 *   `unexpected_response` for a body that is not JSON (Django's HTML 403 of a missing CSRF token)
 *   and `network_error` (status 0) when the request never got an answer.
 * - The provider redirect (`…/auth/provider/redirect`) is a synchronous form post, never a fetch:
 *   `providerRedirectForm` only builds the form the page submits.
 */
import type { SpaConfig } from "./config";
import { ApiError, type FieldErrors } from "./errors";
import { createHeaderProvider, type HeaderProvider, readCookie } from "./headers";

export const ALLAUTH_BROWSER_BASE = "/_allauth/browser/v1";

/** Key of the errors that belong to the whole form, as in Django forms. */
const NON_FIELD = "__all__";
const STATUS_CODES: Record<number, string> = {
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "too_many_requests",
};

/** allauth's `user` (`HEADLESS_ADAPTER.serialize_user`). */
export interface AllauthUser {
  id: string | number;
  email: string;
  display: string;
  has_usable_password: boolean;
}

/** A way forward for an anonymous visitor (`login`, `provider_redirect`, `mfa_authenticate`…). */
export interface AllauthFlow {
  id: string;
  is_pending?: boolean;
  [key: string]: unknown;
}

export type AuthState =
  | { authenticated: true; user: AllauthUser }
  | {
      authenticated: false;
      flows: AllauthFlow[];
      /** Id of the flow that is `is_pending` (e.g. `mfa_authenticate`: the login waits for its 2FA code). */
      pendingFlow?: string;
    };

interface AuthenticatorTimes {
  /** Unix time in seconds (with fraction). */
  created_at: number;
  last_used_at: number | null;
}

/** An entry of `GET …/account/authenticators`, as allauth serialises it. */
export type Authenticator =
  | (AuthenticatorTimes & { type: "totp" })
  | (AuthenticatorTimes & { type: "recovery_codes"; total_code_count: number; unused_code_count: number })
  | (AuthenticatorTimes & { type: "webauthn"; id: number; name: string; is_passwordless?: boolean });

/** A TOTP not yet set up: the secret to type in and the `otpauth://` URL the QR encodes. */
export interface TotpSetup {
  secret: string;
  totpUrl: string;
}

/** A third-party provider, as allauth.headless serialises it. */
export interface AllauthProvider {
  id: string;
  name: string;
  /** How the SPA can use it: `provider_redirect`, `provider_token`. */
  flows: string[];
  client_id?: string;
  openid_configuration_url?: string;
}

/** A third-party account linked to the user (`GET …/account/providers`). */
export interface ProviderAccount {
  /** The account's id at the provider: what `disconnectProvider` takes. */
  uid: string;
  /** A name taken from the provider's data. */
  display: string;
  provider: AllauthProvider;
}

/** `current_password` is left out by an account that has no password yet. */
export interface PasswordChange {
  current_password?: string;
  new_password: string;
}

/**
 * What the provider handshake does once it is back: `login` signs in with the account the provider
 * account is linked to (signed in already, it is a fresh sign-in: how an account that only has
 * Google confirms it is them; another provider account signs in as whoever it belongs to);
 * `connect` links it to the signed-in user.
 */
export type ProviderProcess = "login" | "connect";

/** The form a page posts (synchronously, not with fetch) to start a provider's handshake. */
export interface ProviderRedirectForm {
  action: string;
  method: "post";
  fields: { provider: string; callback_url: string; process: ProviderProcess; csrfmiddlewaretoken: string };
}

export type TotpStatus = { active: true; authenticator: Authenticator } | { active: false; setup: TotpSetup };

export interface RecoveryCodes {
  /** Empty when allauth hides them (`MFA_RECOVERY_CODES_SHOW_ONCE` and already shown). */
  unusedCodes: string[];
  totalCodeCount: number;
  unusedCodeCount: number;
}

/**
 * A protected account call needs a recent login. `flows` are the ids that can confirm it:
 * `reauthenticate` (password, `reauthenticate()`) and `mfa_reauthenticate` (TOTP or recovery code,
 * `mfaReauthenticate()`); retry the call afterwards.
 */
export class ReauthenticationRequiredError extends ApiError {
  readonly flows: string[];

  constructor(flows: string[]) {
    super(401, "reauthentication_required", "Reauthentication required");
    this.name = "ReauthenticationRequiredError";
    this.flows = flows;
  }
}

export function isReauthenticationRequired(err: unknown): err is ReauthenticationRequiredError {
  return err instanceof ReauthenticationRequiredError;
}

export interface AllauthDeps {
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>;
  headers: Pick<HeaderProvider, "apiHeaders">;
  /** Returns the raw cookie string, e.g. `() => document.cookie`. */
  cookies: () => string;
}

export interface AllauthClient {
  getSession(): Promise<AuthState>;
  login(credentials: { email: string; password: string }): Promise<AuthState>;
  /**
   * allauth's sign-up (`…/auth/signup`), answered as the same `AuthState` as `login`: the signed-in
   * user, or the pending code that proves the address (`pendingFlow` `verify_email`). How an address
   * allauth already holds is answered depends on its config (`ACCOUNT_PREVENT_ENUMERATION`).
   */
  signup(credentials: { email: string; password: string }): Promise<AuthState>;
  logout(): Promise<AuthState>;
  /** The code mailed to a login or sign-up whose `pendingFlow` is `verify_email` (allauth's `key`). */
  verifyEmail(code: string): Promise<AuthState>;
  /** Mails a new code for the pending `verify_email`; 409 when the server sends no more. */
  resendEmailVerification(): Promise<void>;
  /** The code mailed to a password login whose `pendingFlow` is `login_by_code`; 409 when none waits. */
  confirmLoginCode(code: string): Promise<AuthState>;
  /** Mails a reset link; the same answer whether the address has an account or not. */
  requestPasswordReset(email: string): Promise<void>;
  /** Checks the key of a reset link and answers its account; an invalid or used key rejects on `key`. */
  passwordResetKeyInfo(key: string): Promise<AllauthUser>;
  /** Sets the new password with the link's key: signed in, or the anonymous state (sign in next). */
  resetPassword(key: string, password: string): Promise<AuthState>;
  /** The second step of a login whose `pendingFlow` is `mfa_authenticate` (TOTP or recovery code). */
  mfaAuthenticate(code: string): Promise<AuthState>;
  reauthenticate(password: string): Promise<void>;
  mfaReauthenticate(code: string): Promise<void>;
  authenticators(): Promise<Authenticator[]>;
  /** `active: false` carries a fresh secret for the QR; activate it with `totpActivatePost`. */
  totpActivateGet(): Promise<TotpStatus>;
  totpActivatePost(code: string): Promise<Authenticator>;
  totpDeactivate(): Promise<void>;
  /** `null` when the account has no recovery codes. */
  recoveryCodesGet(): Promise<RecoveryCodes | null>;
  recoveryCodesRegenerate(): Promise<RecoveryCodes>;
  /** The session after the change: signed in, or signed out when the server ends it on a change. */
  changePassword(change: PasswordChange): Promise<AuthState>;
  /** The third-party accounts linked to the user. */
  providerAccounts(): Promise<ProviderAccount[]>;
  /** Unlinks one (`uid` of `providerAccounts()`); answers the accounts left. */
  disconnectProvider(provider: string, uid: string): Promise<ProviderAccount[]>;
  /** The form that starts a provider's handshake; it comes back to `callbackUrl` (a same-site path). */
  providerRedirectForm(input: { provider: string; callbackUrl: string; process: ProviderProcess }): ProviderRedirectForm;
  /** The CSRF token for a plain form post (a `<form method="post">` to a Django route). */
  csrfToken(): string | undefined;
}

type AllauthConfig = Pick<SpaConfig, "csrfCookieName" | "csrfHeader" | "deviceIdStorageKey">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function browserDeps(cfg: AllauthConfig): AllauthDeps {
  const cookies = () => document.cookie;
  return {
    fetchImpl: (url, init) => globalThis.fetch(url, init),
    cookies,
    headers: createHeaderProvider(cfg, {
      storage: {
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      },
      cookies,
      randomUUID: () => globalThis.crypto.randomUUID(),
    }),
  };
}

function errorOf(status: number, errors: unknown): ApiError {
  const list = Array.isArray(errors) ? errors.filter(isRecord) : [];
  const fields: FieldErrors = {};
  for (const error of list) {
    if (typeof error.message !== "string") continue;
    const field = typeof error.param === "string" ? error.param : NON_FIELD;
    fields[field] = fields[field] ? `${fields[field]} ${error.message}` : error.message;
  }
  const first = list.find((error) => typeof error.message === "string");
  const code = typeof first?.code === "string" ? first.code : (STATUS_CODES[status] ?? "error");
  const message = typeof first?.message === "string" ? first.message : `Request failed (HTTP ${status})`;
  return new ApiError(status, code, message, Object.keys(fields).length > 0 ? fields : undefined);
}

function unexpected(status: number): ApiError {
  return new ApiError(status, "unexpected_response", `Unexpected response (HTTP ${status})`);
}

function flowsOf(raw: unknown): AllauthFlow[] {
  return Array.isArray(raw) ? (raw.filter(isRecord) as AllauthFlow[]) : [];
}

function authenticatorOf(status: number, data: unknown): Authenticator {
  if (!isRecord(data) || typeof data.type !== "string") throw unexpected(status);
  return data as unknown as Authenticator;
}

function recoveryCodesOf(status: number, data: unknown): RecoveryCodes {
  if (!isRecord(data) || typeof data.total_code_count !== "number" || typeof data.unused_code_count !== "number") {
    throw unexpected(status);
  }
  const codes = Array.isArray(data.unused_codes) ? data.unused_codes : [];
  return {
    unusedCodes: codes.filter((code): code is string => typeof code === "string"),
    totalCodeCount: data.total_code_count,
    unusedCodeCount: data.unused_code_count,
  };
}

function providerAccountsOf(status: number, data: unknown): ProviderAccount[] {
  if (!Array.isArray(data)) throw unexpected(status);
  return data.map((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.uid !== "string" || !isRecord(entry.provider) || typeof entry.provider.id !== "string") {
      throw unexpected(status);
    }
    return entry as unknown as ProviderAccount;
  });
}

interface Reply {
  status: number;
  payload: Record<string, unknown>;
}

export function createAllauthClient(cfg: AllauthConfig, overrides: Partial<AllauthDeps> = {}): AllauthClient {
  const deps: AllauthDeps = { ...browserDeps(cfg), ...overrides };

  /** One round trip: a JSON object answer, or the transport errors and the reauthentication. */
  async function send(method: string, path: string, body?: object, extra: Record<string, string> = {}): Promise<Reply> {
    const headers: Record<string, string> = { ...deps.headers.apiHeaders(method), Accept: "application/json", ...extra };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    let res: Response;
    try {
      res = await deps.fetchImpl(`${ALLAUTH_BROWSER_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: "same-origin",
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ApiError(0, "network_error", `Network error (${reason})`);
    }
    let payload: unknown;
    try {
      payload = JSON.parse(await res.text());
    } catch {
      payload = undefined;
    }
    if (!isRecord(payload)) throw unexpected(res.status);
    const meta = isRecord(payload.meta) ? payload.meta : {};
    if (res.status === 401 && meta.is_authenticated === true) {
      const data = isRecord(payload.data) ? payload.data : {};
      throw new ReauthenticationRequiredError(flowsOf(data.flows).map((flow) => flow.id));
    }
    return { status: res.status, payload };
  }

  /** A call whose answer is the session: the signed-in user, or the anonymous state on a 401. */
  async function authState(method: string, path: string, body?: object): Promise<AuthState> {
    const { status, payload } = await send(method, path, body);
    const data = isRecord(payload.data) ? payload.data : {};
    if (status === 200 && isRecord(data.user)) return { authenticated: true, user: data.user as unknown as AllauthUser };
    if (status === 401) {
      const flows = flowsOf(data.flows);
      const pending = flows.find((flow) => flow.is_pending === true);
      return pending ? { authenticated: false, flows, pendingFlow: pending.id } : { authenticated: false, flows };
    }
    throw errorOf(status, payload.errors);
  }

  /** A call of a signed-in user: the reply on a 200 (or a 404 when `notFoundIsAnswer`), else it rejects. */
  async function account(method: string, path: string, body?: object, notFoundIsAnswer = false): Promise<Reply> {
    const reply = await send(method, path, body);
    if (reply.status === 200 || (notFoundIsAnswer && reply.status === 404)) return reply;
    if (reply.status === 401) throw new ApiError(401, "not_authenticated", "Not signed in");
    throw errorOf(reply.status, reply.payload.errors);
  }

  /** A call of an anonymous visitor answered with a plain 200; anything else rejects. */
  async function anonymousCall(method: string, path: string, body?: object, extra?: Record<string, string>): Promise<Reply> {
    const reply = await send(method, path, body, extra);
    if (reply.status === 200) return reply;
    throw errorOf(reply.status, reply.payload.errors);
  }

  return {
    getSession: () => authState("GET", "/auth/session"),
    login: (credentials) => authState("POST", "/auth/login", credentials),
    signup: (credentials) => authState("POST", "/auth/signup", credentials),
    logout: () => authState("DELETE", "/auth/session"),
    verifyEmail: (code) => authState("POST", "/auth/email/verify", { key: code }),
    resendEmailVerification: async () => {
      await anonymousCall("POST", "/auth/email/verify/resend");
    },
    confirmLoginCode: (code) => authState("POST", "/auth/code/confirm", { code }),
    requestPasswordReset: async (email) => {
      await anonymousCall("POST", "/auth/password/request", { email });
    },
    passwordResetKeyInfo: async (key) => {
      const { status, payload } = await anonymousCall("GET", "/auth/password/reset", undefined, { "X-Password-Reset-Key": key });
      const data = isRecord(payload.data) ? payload.data : {};
      if (!isRecord(data.user)) throw unexpected(status);
      return data.user as unknown as AllauthUser;
    },
    resetPassword: (key, password) => authState("POST", "/auth/password/reset", { key, password }),
    mfaAuthenticate: (code) => authState("POST", "/auth/2fa/authenticate", { code }),
    reauthenticate: async (password) => {
      await account("POST", "/auth/reauthenticate", { password });
    },
    mfaReauthenticate: async (code) => {
      await account("POST", "/auth/2fa/reauthenticate", { code });
    },
    authenticators: async () => {
      const { status, payload } = await account("GET", "/account/authenticators");
      if (!Array.isArray(payload.data)) throw unexpected(status);
      return payload.data.map((entry) => authenticatorOf(status, entry));
    },
    totpActivateGet: async () => {
      const { status, payload } = await account("GET", "/account/authenticators/totp", undefined, true);
      if (status === 200) return { active: true, authenticator: authenticatorOf(status, payload.data) };
      const meta = isRecord(payload.meta) ? payload.meta : {};
      if (typeof meta.secret === "string" && typeof meta.totp_url === "string") {
        return { active: false, setup: { secret: meta.secret, totpUrl: meta.totp_url } };
      }
      throw errorOf(status, payload.errors);
    },
    totpActivatePost: async (code) => {
      const { status, payload } = await account("POST", "/account/authenticators/totp", { code });
      return authenticatorOf(status, payload.data);
    },
    totpDeactivate: async () => {
      await account("DELETE", "/account/authenticators/totp");
    },
    recoveryCodesGet: async () => {
      const { status, payload } = await account("GET", "/account/authenticators/recovery-codes", undefined, true);
      return status === 404 ? null : recoveryCodesOf(status, payload.data);
    },
    recoveryCodesRegenerate: async () => {
      const { status, payload } = await account("POST", "/account/authenticators/recovery-codes");
      return recoveryCodesOf(status, payload.data);
    },
    changePassword: (change) => authState("POST", "/account/password/change", change),
    providerAccounts: async () => {
      const { status, payload } = await account("GET", "/account/providers");
      return providerAccountsOf(status, payload.data);
    },
    disconnectProvider: async (provider, uid) => {
      const { status, payload } = await account("DELETE", "/account/providers", { provider, account: uid });
      return providerAccountsOf(status, payload.data);
    },
    providerRedirectForm: ({ provider, callbackUrl, process }) => ({
      action: `${ALLAUTH_BROWSER_BASE}/auth/provider/redirect`,
      method: "post",
      fields: {
        provider,
        callback_url: callbackUrl,
        process,
        csrfmiddlewaretoken: readCookie(deps.cookies(), cfg.csrfCookieName) ?? "",
      },
    }),
    csrfToken: () => readCookie(deps.cookies(), cfg.csrfCookieName),
  };
}
