// Trusted Types `default` policy for the SPA. The CSP carries `require-trusted-types-for 'script'`
// (PLAN §4.3); the only legitimate DOM-string sinks are the icons (Ionic's `ion-icon` and our
// HubIcon), so in production `createHTML` lets through only two shapes:
//   - inline SVG markup, starting with `<svg` (what `ion-icon` writes into its shadow root);
//   - an SVG data URL, `data:image/svg+xml;utf8,<svg …>`: every icon of the shell (`ION_ICONS`
//     from `ionicons/icons` and the baked sets of `icons.ts`) has this shape, and ionicons resolves
//     it with `DOMParser.parseFromString(url, 'text/html')`, itself a Trusted Types sink.
// Anything else (other tags, other data URLs, base64) is rejected, as is every inline script
// (`createScript`).
// Script URLs (`createScriptURL`) are rejected too, except those the allowlist the project passes admits
// (`createShell({ trustedScriptOrigins })`, default none): `https`, no credentials, no wildcard. An entry is a
// bare origin (`https://js.stripe.com`: the URL's `new URL(url).origin` is EXACTLY it) or an origin with a path
// that ends in `/` (`https://www.google.com/recaptcha/`: that origin, and the URL's normalised path starts with
// it; nothing else of the origin). It exists for a third-party loader that sets its own chunks' `src` as plain
// strings without a policy of its own, which then reach this `default` policy: Stripe.js and reCAPTCHA
// Enterprise (the SaaS passes `https://js.stripe.com` and Google's two `/recaptcha/` paths). It is one mechanism
// for every script URL of the page, so a project needs no policy of its own: the CSP's `trusted-types` names
// `default` (`live.csp`), and its `script-src` still decides, page by page, what may load.
// Unlike the other boot hooks this one has no import-time side effect: the shell entry point calls
// `installTrustedTypesPolicy()` explicitly, before mounting. In dev (Vite HMR injects strings) every HTML string passes.

/** `<svg …>` markup, or the `;utf8,` SVG data URL ionicons parses inline (raw SVG after the comma). */
const ICON_HTML = /^(?:data:image\/svg\+xml;utf8,\s*)?<svg[\s/>]/;

type TrustedTypesWindow = Window & {
  trustedTypes?: {
    defaultPolicy?: unknown;
    createPolicy: (name: string, rules: Record<string, (value: string) => string>) => unknown;
  };
};

/** The absolute URL `value` names, or `null` (relative or malformed). `URL.canParse` is too new for older Safari. */
function absoluteURL(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** `https://host[:port]` exactly as `URL.origin` writes it: no path, credentials or wildcard. */
function isBareHttpsOrigin(origin: string): boolean {
  const url = absoluteURL(origin);
  return !origin.includes('*') && url?.protocol === 'https:' && url.origin === origin;
}

/** `https://host[:port]/path/` exactly as `URL` writes it (normalised, no `..`), the path not `/` and ending in `/`:
 *  no credentials, query, fragment or wildcard. */
function isHttpsPathPrefix(entry: string): boolean {
  const url = absoluteURL(entry);
  return (
    !entry.includes('*') &&
    url?.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    url.pathname !== '/' &&
    url.pathname.endsWith('/') &&
    `${url.origin}${url.pathname}` === entry
  );
}

/** What an allowlist entry admits: an origin, and the path under which a URL of it must be (`/` for a bare one). */
interface ScriptPlace {
  origin: string;
  path: string;
}

function placeOf(entry: string): ScriptPlace {
  const url = new URL(entry);
  return { origin: url.origin, path: isBareHttpsOrigin(entry) ? '/' : url.pathname };
}

/** An absolute `https` URL, without credentials, of one of `places`' origins and under its path. */
function isAllowedScriptURL(value: string, places: readonly ScriptPlace[]): boolean {
  const url = absoluteURL(value);
  if (url?.protocol !== 'https:' || url.username || url.password) return false;
  return places.some((place) => url.origin === place.origin && url.pathname.startsWith(place.path));
}

/**
 * Installs the `default` policy. Returns `true` only when it was created now. `scriptOrigins`: where the script
 * URLs it admits may be, each a bare `https://host[:port]` or one with a path ending in `/` (anything else throws).
 */
export function installTrustedTypesPolicy(
  win: Window = window,
  dev: boolean = import.meta.env.DEV,
  scriptOrigins: readonly string[] = [],
): boolean {
  const invalid = scriptOrigins.filter((origin) => !isBareHttpsOrigin(origin) && !isHttpsPathPrefix(origin));
  if (invalid.length) {
    throw new TypeError(
      `Trusted Types: script origins must be bare https origins or https origins with a path ending in /: ${invalid.join(', ')}`,
    );
  }
  const places: readonly ScriptPlace[] = scriptOrigins.map(placeOf);
  const tt = (win as TrustedTypesWindow).trustedTypes;
  if (!tt?.createPolicy || tt.defaultPolicy) return false;
  try {
    tt.createPolicy('default', {
      createHTML: (html: string): string => {
        if (dev || ICON_HTML.test(html.trim())) return html;
        throw new TypeError('Trusted Types: only <svg> markup or an SVG data URL is allowed as HTML');
      },
      createScriptURL: (url: string): string => {
        if (isAllowedScriptURL(url, places)) return url;
        throw new TypeError('Trusted Types: script URLs are only allowed from the trusted script origins');
      },
      createScript: (): string => {
        throw new TypeError('Trusted Types: scripts are not allowed');
      },
    });
    return true;
  } catch (error) {
    console.error('[trusted-types] could not install the default policy', error);
    return false;
  }
}
