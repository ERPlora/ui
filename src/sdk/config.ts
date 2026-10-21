/**
 * Runtime configuration embedded by Django in the SPA shell:
 * `<script id="spa-config" type="application/json">{…}</script>` (rendered with the CSP nonce).
 * The CSRF cookie name always comes from here; the SDK never assumes one.
 * `routes` (op → method/path) is optional: the project may import its generated map instead.
 */
import { type OperationRoutes, parseOperationRoutes } from "./operations";

export interface SpaConfig {
  csrfCookieName: string;
  csrfHeader: string;
  liveUrl: string;
  apiBase: string;
  lang: string;
  palette?: string;
  deviceIdStorageKey: string;
  /** Where the shell's auth gate sends a visitor without a session (it appends `next=`). */
  loginUrl?: string;
  /** SaaS login: whether «Continue with Google» is configured (the button is hidden otherwise). */
  googleEnabled?: boolean;
  /** SaaS: whether two-step verification is switched on (its endpoints answer 404 otherwise: nothing to ask). */
  mfaEnabled?: boolean;
  /** SaaS: a hub's origin with `{slug}` to fill in (`https://{slug}.erplora.com`), to name a hub from its slug. */
  hubOrigin?: string;
  routes?: OperationRoutes;
}

export const SPA_CONFIG_ELEMENT_ID = "spa-config";

const DEFAULTS = {
  csrfHeader: "X-CSRFToken",
  liveUrl: "/api/live",
  apiBase: "/api",
  deviceIdStorageKey: "erplora.device_id",
} as const;

const OPTIONAL_STRINGS = [
  "csrfHeader",
  "liveUrl",
  "apiBase",
  "palette",
  "deviceIdStorageKey",
  "loginUrl",
  "hubOrigin",
] as const;

export class SpaConfigError extends Error {
  constructor(message: string) {
    super(`spa-config: ${message}`);
    this.name = "SpaConfigError";
  }
}

function requiredString(raw: Record<string, unknown>, key: string): string {
  const value = raw[key];
  if (typeof value !== "string" || value === "") {
    throw new SpaConfigError(`"${key}" must be a non-empty string`);
  }
  return value;
}

function optionalString(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value === "") {
    throw new SpaConfigError(`"${key}" must be a non-empty string when present`);
  }
  return value;
}

function optionalBoolean(raw: Record<string, unknown>, key: string): boolean | undefined {
  const value = raw[key];
  if (value === undefined || typeof value === "boolean") return value;
  throw new SpaConfigError(`"${key}" must be a boolean when present`);
}

function parse(text: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new SpaConfigError(`content is not valid JSON (${(err as Error).message})`);
  }
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new SpaConfigError("content must be a JSON object");
  }
  return raw as Record<string, unknown>;
}

export function readSpaConfig(doc: Document = document): SpaConfig {
  const el = doc.getElementById(SPA_CONFIG_ELEMENT_ID);
  if (!el) {
    throw new SpaConfigError(`missing <script id="${SPA_CONFIG_ELEMENT_ID}" type="application/json"> element`);
  }
  if (el.tagName !== "SCRIPT" || el.getAttribute("type") !== "application/json") {
    throw new SpaConfigError(`#${SPA_CONFIG_ELEMENT_ID} must be a <script type="application/json"> element`);
  }
  const raw = parse(el.textContent ?? "");
  const optional: Partial<Record<(typeof OPTIONAL_STRINGS)[number], string>> = {};
  for (const key of OPTIONAL_STRINGS) {
    const value = optionalString(raw, key);
    if (value !== undefined) optional[key] = value;
  }
  const cfg: SpaConfig = {
    ...DEFAULTS,
    ...optional,
    csrfCookieName: requiredString(raw, "csrfCookieName"),
    lang: requiredString(raw, "lang"),
  };
  const googleEnabled = optionalBoolean(raw, "googleEnabled");
  if (googleEnabled !== undefined) cfg.googleEnabled = googleEnabled;
  const mfaEnabled = optionalBoolean(raw, "mfaEnabled");
  if (mfaEnabled !== undefined) cfg.mfaEnabled = mfaEnabled;
  if (raw.routes !== undefined) {
    try {
      cfg.routes = parseOperationRoutes(raw.routes);
    } catch (err) {
      throw new SpaConfigError(`"routes": ${(err as Error).message}`);
    }
  }
  return cfg;
}
