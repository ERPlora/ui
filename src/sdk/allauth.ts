// Transport for allauth.headless's browser API, used by the SaaS's account pages: allauth decides everything. The
// session cookie is same-origin, and unsafe methods carry Django's CSRF token from the header provider (the SPA's HTML
// sets the cookie, and so does `GET …/auth/session`). Failures reject with the SDK's `ApiError`, allauth's
// `errors[{param, code, message}]` becoming its `fields` per input.
import type { SpaConfig } from "./config";
import { ApiError } from "./errors";
import { createHeaderProvider, type HeaderProvider, readCookie } from "./headers";
import { sdkMessage } from "./messages";
import {
  type AllauthUser,
  type Authenticator,
  authenticatorOf,
  type AuthState,
  errorOf,
  flowsOf,
  isRecord,
  type ProviderAccount,
  providerAccountsOf,
  ReauthenticationRequiredError,
  type RecoveryCodes,
  recoveryCodesOf,
  type TotpStatus,
  unexpected,
} from "./allauth-replies";

export const ALLAUTH_BROWSER_BASE = "/_allauth/browser/v1";

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
  /**
   * The answer to «Trust this browser» when the login's `pendingFlow` is `mfa_trust` (allauth's `MFA_TRUST_ENABLED`,
   * after a right 2FA code): `true` skips the app's code in this browser for a while. When no login waits for it
   * (none, asked before the code, or already signed in from another tab) allauth answers the anonymous state (401,
   * no `mfa_trust` pending), like any other call here; it never answers a 409 for that.
   */
  mfaTrust(trust: boolean): Promise<AuthState>;
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

interface Reply {
  status: number;
  payload: Record<string, unknown>;
}

export function createAllauthClient(cfg: AllauthConfig, overrides: Partial<AllauthDeps> = {}): AllauthClient {
  const deps: AllauthDeps = { ...browserDeps(cfg), ...overrides };

  /**
   * One round trip: a JSON object answer, or the transport errors. A 401 of a signed-in user (`meta.is_authenticated`)
   * is not the anonymous state: a protected account call needs a recent login.
   */
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
      throw new ApiError(0, "network_error", sdkMessage("network"), undefined, { reason });
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

  /**
   * A call whose answer is the session: the signed-in user, or on a 401 the anonymous state with the `flows` the
   * visitor can take; a login that needs another step (2FA, email verification) marks that flow `is_pending`.
   */
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

  /**
   * A call of a signed-in user: the reply on a 200, or on a 404 when `notFoundIsAnswer` («none yet» of the TOTP setup
   * and the recovery codes); elsewhere a 404 means two-factor authentication is switched off on the server.
   */
  async function account(method: string, path: string, body?: object, notFoundIsAnswer = false): Promise<Reply> {
    const reply = await send(method, path, body);
    if (reply.status === 200 || (notFoundIsAnswer && reply.status === 404)) return reply;
    if (reply.status === 401) throw new ApiError(401, "not_authenticated", sdkMessage("signedOut"));
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
    mfaTrust: (trust) => authState("POST", "/auth/2fa/trust", { trust }),
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
