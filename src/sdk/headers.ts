/**
 * Request headers shared by the live stream and the API client.
 *
 * - `X-Device-Id`: one id per browser profile, persisted in storage.
 * - `X-Client-Instance`: one id per provider (one per tab), kept in memory only.
 * - `X-Elevation-Token`: optional, supplied by a hook at call time.
 * - CSRF: only on unsafe methods, read from the cookie named in the SPA config.
 */
import type { SpaConfig } from "./config";

export const DEVICE_ID_HEADER = "X-Device-Id";
export const CLIENT_INSTANCE_HEADER = "X-Client-Instance";
export const ELEVATION_TOKEN_HEADER = "X-Elevation-Token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HeaderConfig = Pick<SpaConfig, "csrfCookieName" | "csrfHeader" | "deviceIdStorageKey">;

export interface HeaderDeps {
  storage: Pick<Storage, "getItem" | "setItem">;
  /** Returns the raw cookie string, e.g. `() => document.cookie`. */
  cookies: () => string;
  randomUUID: () => string;
  getElevationToken?: () => string | undefined;
}

export interface HeaderProvider {
  liveHeaders(): Record<string, string>;
  apiHeaders(method: string): Record<string, string>;
}

export function readCookie(cookieString: string, name: string): string | undefined {
  for (const part of cookieString.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

function loadDeviceId(key: string, deps: HeaderDeps): string {
  let stored: string | null = null;
  try {
    stored = deps.storage.getItem(key);
  } catch {
    // Storage can be blocked (privacy mode, policy): fall back to a fresh id below.
  }
  if (stored && UUID.test(stored)) return stored;
  const id = deps.randomUUID();
  try {
    deps.storage.setItem(key, id);
  } catch {
    // Not persisted: the id still identifies this tab's session until reload.
  }
  return id;
}

export function createHeaderProvider(cfg: HeaderConfig, deps: HeaderDeps): HeaderProvider {
  const deviceId = loadDeviceId(cfg.deviceIdStorageKey, deps);
  const clientInstance = deps.randomUUID();

  function base(accept: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: accept,
      [DEVICE_ID_HEADER]: deviceId,
      [CLIENT_INSTANCE_HEADER]: clientInstance,
    };
    const elevation = deps.getElevationToken?.();
    if (elevation) headers[ELEVATION_TOKEN_HEADER] = elevation;
    return headers;
  }

  return {
    liveHeaders: () => base("text/event-stream"),
    apiHeaders(method) {
      const headers = base("application/json");
      if (!SAFE_METHODS.has(method.toUpperCase())) {
        const token = readCookie(deps.cookies(), cfg.csrfCookieName);
        if (token) headers[cfg.csrfHeader] = token;
      }
      return headers;
    },
  };
}
