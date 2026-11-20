// The answers of allauth.headless's browser API: the shapes of their `data`, and how the client reads them and their
// failures.
import { ApiError, type FieldErrors } from "./errors";
import { sdkMessage } from "./messages";

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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function errorOf(status: number, errors: unknown): ApiError {
  const list = Array.isArray(errors) ? errors.filter(isRecord) : [];
  const fields: FieldErrors = {};
  for (const error of list) {
    if (typeof error.message !== "string") continue;
    const field = typeof error.param === "string" ? error.param : NON_FIELD;
    fields[field] = fields[field] ? `${fields[field]} ${error.message}` : error.message;
  }
  const first = list.find((error) => typeof error.message === "string");
  const code = typeof first?.code === "string" ? first.code : (STATUS_CODES[status] ?? "error");
  const message = typeof first?.message === "string" ? first.message : sdkMessage("unexpected");
  return new ApiError(status, code, message, Object.keys(fields).length > 0 ? fields : undefined);
}

export function unexpected(status: number): ApiError {
  return new ApiError(status, "unexpected_response", sdkMessage("unexpected"));
}

export function flowsOf(raw: unknown): AllauthFlow[] {
  return Array.isArray(raw) ? (raw.filter(isRecord) as AllauthFlow[]) : [];
}

export function authenticatorOf(status: number, data: unknown): Authenticator {
  if (!isRecord(data) || typeof data.type !== "string") throw unexpected(status);
  return data as unknown as Authenticator;
}

export function recoveryCodesOf(status: number, data: unknown): RecoveryCodes {
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

export function providerAccountsOf(status: number, data: unknown): ProviderAccount[] {
  if (!Array.isArray(data)) throw unexpected(status);
  return data.map((entry: unknown) => {
    if (!isRecord(entry) || typeof entry.uid !== "string" || !isRecord(entry.provider) || typeof entry.provider.id !== "string") {
      throw unexpected(status);
    }
    return entry as unknown as ProviderAccount;
  });
}
