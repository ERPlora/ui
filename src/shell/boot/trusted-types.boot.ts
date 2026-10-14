// Trusted Types `default` policy for the SPA. The CSP carries `require-trusted-types-for 'script'`
// (PLAN §4.3); the only legitimate DOM-string sinks are the icons (Ionic's `ion-icon` and our
// HubIcon), so in production `createHTML` lets through only two shapes:
//   - inline SVG markup, starting with `<svg` (what `ion-icon` writes into its shadow root);
//   - an SVG data URL, `data:image/svg+xml;utf8,<svg …>`: every icon of the shell (`ION_ICONS`
//     from `ionicons/icons` and the baked sets of `icons.ts`) has this shape, and ionicons resolves
//     it with `DOMParser.parseFromString(url, 'text/html')`, itself a Trusted Types sink.
// Anything else (other tags, other data URLs, base64) is rejected, as is every inline script
// (`createScript`).
// Script URLs (`createScriptURL`) are rejected too, except those whose origin is EXACTLY one of the
// allowlist the project passes (`createShell({ trustedScriptOrigins })`, default none): `https`, no
// credentials, no wildcard, compared with `new URL(url).origin`. It exists for a third-party loader
// that sets its own chunks' `src` as plain strings without a policy of its own, which then reach this
// `default` policy: Stripe.js (the SaaS passes `['https://js.stripe.com']`). It is one mechanism for
// every script URL of the page, so a project needs no policy of its own: the CSP's `trusted-types`
// names `default` (`live.csp`), and its `script-src` still decides, page by page, what may load.
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

/** An absolute `https` URL, without credentials, whose origin is one of `origins`. */
function isAllowedScriptURL(value: string, origins: ReadonlySet<string>): boolean {
  const url = absoluteURL(value);
  return url?.protocol === 'https:' && !url.username && !url.password && origins.has(url.origin);
}

/**
 * Installs the `default` policy. Returns `true` only when it was created now. `scriptOrigins`: the
 * origins whose script URLs it admits (each a bare `https://host[:port]`; anything else throws).
 */
export function installTrustedTypesPolicy(
  win: Window = window,
  dev: boolean = import.meta.env.DEV,
  scriptOrigins: readonly string[] = [],
): boolean {
  const invalid = scriptOrigins.filter((origin) => !isBareHttpsOrigin(origin));
  if (invalid.length) {
    throw new TypeError(`Trusted Types: script origins must be bare https origins: ${invalid.join(', ')}`);
  }
  const origins: ReadonlySet<string> = new Set(scriptOrigins);
  const tt = (win as TrustedTypesWindow).trustedTypes;
  if (!tt?.createPolicy || tt.defaultPolicy) return false;
  try {
    tt.createPolicy('default', {
      createHTML: (html: string): string => {
        if (dev || ICON_HTML.test(html.trim())) return html;
        throw new TypeError('Trusted Types: only <svg> markup or an SVG data URL is allowed as HTML');
      },
      createScriptURL: (url: string): string => {
        if (isAllowedScriptURL(url, origins)) return url;
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
