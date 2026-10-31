// A screen whose file never arrives (gh:hub#438; the old hub's hub#1518 and hub#2312). Every screen is a lazy chunk
// with a hashed name (`/static/spa/assets/<Page>-<hash>.js`, served immutable), so opening one is a fetch. After a
// deploy the new image no longer serves the names an open tab knows: its `import()` fails, the router aborts the
// navigation, and with no `onError` anywhere the tap did nothing and said nothing until the app was restarted.
//
// A retry inside the SPA cannot work: per the HTML module map, a module URL that failed is remembered as failed for
// the life of the document. Only a fresh document clears it, and the fresh document's HTML (never cached, `render_spa`)
// names the new chunks. So, as Nuxt, Next.js, Remix and Gatsby do for a chunk lost on navigation, the screen asked for
// opens in a fresh document. Offline that document would be the browser's error page, with no way back to the till:
// there the person keeps the screen they are on and a toast says so, with a Retry that opens it afresh.
//
// Not here: the first screen of a document (the project's entry decides what an unmounted page does) and a screen
// whose own code throws (a fresh document runs the same code: it stays as loud as vue-router left it).
import type { Router } from 'vue-router';

import { shellText } from './i18n';
import { toast } from './toast';

/** The toast's id, so a second failure replaces it instead of stacking. */
export const VIEW_LOAD_TOAST = 'view-load-failed';

// How each engine words "the file behind this screen never arrived" (Chromium, Firefox, Safari), and Vite's preload
// helper for the stylesheet half of a chunk.
const VIEW_LOAD_ERROR_PATTERNS = [
  'failed to fetch dynamically imported module',
  'error loading dynamically imported module',
  'importing a module script failed',
  'unable to preload css',
];

/** True when `error` is the browser failing to FETCH a screen's file, not the screen's own code throwing. */
export function isViewLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return VIEW_LOAD_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * `href` as an address of this origin, or `null` when it would leave it: the router keeps whatever path it is
 * handed, and `//host/x` comes back unchanged and reads as another origin to the browser.
 */
export function sameOriginHref(href: string, here: string): string | null {
  try {
    const url = new URL(href, here);
    return url.origin === new URL(here).origin ? href : null;
  } catch {
    return null;
  }
}

/** Installs the recovery on the shell's router; `open` is a document navigation (the router's `redirect`). */
export function installViewLoadRecovery(router: Router, open: (url: string) => void): void {
  router.onError((error, to, from) => {
    // Registering a listener switches off vue-router's own `console.error`: whatever is not handled here stays loud.
    // An empty `matched` is the document's first navigation, which has no screen to keep.
    if (!isViewLoadError(error) || from.matched.length === 0) {
      console.error(error);
      return;
    }
    const href = sameOriginHref(router.resolve(to.fullPath).href, window.location.href);
    if (href && window.navigator.onLine !== false) {
      open(href);
      return;
    }
    console.error(error);
    void toast(shellText('viewLoad.failed'), 'danger', 0, VIEW_LOAD_TOAST, {
      text: shellText('viewLoad.retry'),
      handler: () => (href ? open(href) : window.location.reload()),
    });
  });
}
