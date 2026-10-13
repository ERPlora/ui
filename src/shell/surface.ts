// Where the shell is running (PLAN-SAAS §3.6, point 5; mockups README §4). Four surfaces:
//   - `web`      a browser: everything, selling included;
//   - `desktop`  the desktop app (Tauri on Windows);
//   - `mobile`   the mobile app (Tauri on Android; or any WebView that announces itself);
//   - `account`  the account the app opens in the SYSTEM browser (`?surface=account`): a browser, but
//                with the doors to buying closed, like inside the app.
// Everything that sells is web only (`<WebOnly>`, `v-web-only`, a route's `meta.webOnly`); the other
// three surfaces get the in-app rules. `createShell` boots it: `<html data-surface="…">` and, off the
// web, `html.in-app-shell` (the class the SaaS templates already used, saas#2083), for CSS hooks.
//
// How each surface is told, strongest signal first:
//   1. `createShell({ surface })`: the entry knows (the server's `spa-config`, a test).
//   2. Native signals, which a link cannot fake:
//      - the Tauri bridge: Tauri injects `__TAURI_INTERNALS__` (and `__TAURI__` with
//        `withGlobalTauri`) before any script of the page runs — the installed apps already carry it;
//      - the user agent token `ERPloraApp/<version>`, for a native WebView without the bridge. A
//        native app sets it by appending to its WebView's user agent: Tauri `app.windows[].userAgent`
//        in `tauri.conf.json`, Android `WebSettings.setUserAgentString(default + " ERPloraApp/x.y.z")`,
//        iOS `WKWebView.customUserAgent`.
//      Phone or tablet user agent (Android, iPhone, iPad, iPod) → `mobile`; else `desktop`.
//   3. `?surface=<surface>` in the address: the account the app opens in the browser, or a WebView
//      that cannot touch its user agent (`https://erplora.com/shell/?surface=mobile`).
//   4. `<html data-surface="…">` rendered by the server: the hint of 3 kept in the session, so it
//      survives the redirects of signing in (the query does not).
//   5. Otherwise, the web.
import { computed, type ComputedRef, type ObjectDirective, readonly, type Ref, ref, watchEffect, type WatchStopHandle } from 'vue';

export const SURFACES = ['web', 'desktop', 'mobile', 'account'] as const;
export type Surface = (typeof SURFACES)[number];

/** Class on `<html>` off the web (the SaaS templates' convention, saas#2083). */
export const IN_APP_CLASS = 'in-app-shell';

/** Token a native WebView appends to its user agent to say it is the app. */
const APP_USER_AGENT = /\bERPloraApp\/\S+/;
/** A phone or tablet: the app there is the mobile one. */
const MOBILE_USER_AGENT = /Android|iPhone|iPad|iPod/i;

/** What `detectSurface` reads of the window: the bridge, the user agent, the query and `<html>`. */
export interface SurfaceWindow {
  navigator: { userAgent: string };
  location: { search: string };
  document: { documentElement: { dataset: DOMStringMap } };
  __TAURI_INTERNALS__?: unknown;
  __TAURI__?: unknown;
}

export function isSurface(value: unknown): value is Surface {
  return typeof value === 'string' && (SURFACES as readonly string[]).includes(value);
}

/** The surface the shell is running on (see the order at the top of this file). */
export function detectSurface({
  explicit,
  win = window as unknown as SurfaceWindow,
}: { explicit?: Surface; win?: SurfaceWindow } = {}): Surface {
  if (explicit) return explicit;
  const agent = win.navigator.userAgent;
  if (win.__TAURI_INTERNALS__ || win.__TAURI__ || APP_USER_AGENT.test(agent)) {
    return MOBILE_USER_AGENT.test(agent) ? 'mobile' : 'desktop';
  }
  const asked = new URLSearchParams(win.location.search).get('surface');
  if (isSurface(asked)) return asked;
  const rendered = win.document.documentElement.dataset.surface;
  return isSurface(rendered) ? rendered : 'web';
}

const current = ref<Surface>('web');

/** Sets the surface: the live state of `useSurface` and the marks on `<html>`. */
export function applySurface(surface: Surface, root: HTMLElement = document.documentElement): void {
  current.value = surface;
  root.dataset.surface = surface;
  root.classList.toggle(IN_APP_CLASS, surface !== 'web');
}

/**
 * Detects and applies the surface at boot (createShell), and looks again once the document is
 * parsed and once it has loaded: Android WebViews without document-start scripts inject the bridge
 * on page start, in no guaranteed order. Returns the cleanup of those listeners.
 */
export function bootSurface(options: { surface?: Surface } = {}): () => void {
  const apply = (): void => applySurface(detectSurface({ explicit: options.surface }));
  apply();
  const stops: Array<() => void> = [];
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply, { once: true });
    stops.push(() => document.removeEventListener('DOMContentLoaded', apply));
  }
  if (document.readyState !== 'complete') {
    window.addEventListener('load', apply, { once: true });
    stops.push(() => window.removeEventListener('load', apply));
  }
  return () => stops.forEach((stop) => stop());
}

export interface SurfaceState {
  /** The surface, live. */
  surface: Readonly<Ref<Surface>>;
  /** A browser on the web: what sells may be painted. */
  isWeb: ComputedRef<boolean>;
  /** The in-app rules apply: inside an app, or the account the app opened in the browser. */
  inApp: ComputedRef<boolean>;
}

const state: SurfaceState = {
  surface: readonly(current),
  isWeb: computed(() => current.value === 'web'),
  inApp: computed(() => current.value !== 'web'),
};

/** The surface, live (it changes when a late bridge is found). */
export function useSurface(): SurfaceState {
  return state;
}

type WebOnlyElement = HTMLElement & { _webOnlyDisplay?: string; _webOnlyStop?: WatchStopHandle };

/** Shows the element as its own style says on the web, hides it everywhere else. */
function paint(el: WebOnlyElement): void {
  el.style.display = state.isWeb.value ? (el._webOnlyDisplay ?? '') : 'none';
}

/**
 * `v-web-only`: the element shows on the web only, following the surface live (like `v-show`, so
 * it stays in the DOM). For whole blocks, and for the text that replaces them in the apps, use
 * `<WebOnly>`, which does not even render them off the web.
 */
export const vWebOnly: ObjectDirective<WebOnlyElement> = {
  beforeMount(el) {
    el._webOnlyDisplay = el.style.display === 'none' ? '' : el.style.display;
    el._webOnlyStop = watchEffect(() => paint(el));
  },
  updated(el) {
    // A re-render may have rewritten `style`: the surface still decides `display`.
    paint(el);
  },
  unmounted(el) {
    el._webOnlyStop?.();
    el._webOnlyStop = undefined;
  },
};
