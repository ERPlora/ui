// Trusted Types `default` policy for the SPA. The CSP carries `require-trusted-types-for 'script'`
// (PLAN §4.3); the only legitimate DOM-string sink is the inline SVG of icons (Ionic's `ion-icon`
// and our HubIcon), so in production `createHTML` lets through only strings starting with `<svg`.
// Everything that would load or run script (`createScriptURL`, `createScript`) is rejected.
// Unlike the other boot hooks this one has no import-time side effect: the shell entry point calls
// `installTrustedTypesPolicy()` explicitly, before mounting. In dev (Vite HMR injects strings) every HTML string passes.

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
        if (dev || html.trim().startsWith('<svg')) return html;
        throw new TypeError('Trusted Types: only <svg> markup is allowed as HTML');
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
