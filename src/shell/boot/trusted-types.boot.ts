// Trusted Types `default` policy for the SPA. The CSP carries `require-trusted-types-for 'script'`
// (PLAN §4.3); the only legitimate DOM-string sinks are the icons (Ionic's `ion-icon` and our
// HubIcon), so in production `createHTML` lets through only two shapes:
//   - inline SVG markup, starting with `<svg` (what `ion-icon` writes into its shadow root);
//   - an SVG data URL, `data:image/svg+xml;utf8,<svg …>`: every icon of the shell (`ION_ICONS`
//     from `ionicons/icons` and the baked sets of `icons.ts`) has this shape, and ionicons resolves
//     it with `DOMParser.parseFromString(url, 'text/html')`, itself a Trusted Types sink.
// Anything else (other tags, other data URLs, base64) is rejected, as is everything that would load
// or run script (`createScriptURL`, `createScript`).
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

/** Installs the `default` policy. Returns `true` only when it was created now. */
export function installTrustedTypesPolicy(
  win: Window = window,
  dev: boolean = import.meta.env.DEV,
): boolean {
  const tt = (win as TrustedTypesWindow).trustedTypes;
  if (!tt?.createPolicy || tt.defaultPolicy) return false;
  try {
    tt.createPolicy('default', {
      createHTML: (html: string): string => {
        if (dev || ICON_HTML.test(html.trim())) return html;
        throw new TypeError('Trusted Types: only <svg> markup or an SVG data URL is allowed as HTML');
      },
      createScriptURL: (): string => {
        throw new TypeError('Trusted Types: script URLs are not allowed');
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
