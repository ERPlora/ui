// The way out of the app (the old hub's `open-external.ts`, gh:hub#475): a link to another project's page — the
// hub's «My account», «Report a problem» and «erplora.com» of the bar — is a real link (`target="_blank"`,
// `rel="noopener"`), and a browser opens it in a new tab by itself. The installed app opens nothing on
// `target=_blank` (the webview spawns no window), so there the click hands the address to the system browser
// through the shell's `open_external_url`, which only takes our own addresses, and a refusal is said: a button
// that does nothing when pressed is the defect this exists to end.
import { shellText } from './i18n';
import { toastError } from './toast';

/** The installed app's command that opens an address in the person's own browser. */
export const OPEN_EXTERNAL_COMMAND = 'open_external_url';

/** The installed app's bridge (Tauri), absent in a browser. */
type NativeWindow = { __TAURI__?: { core?: { invoke?: (command: string, args?: Record<string, unknown>) => Promise<unknown> } } };

/**
 * The click of a link to `url` outside the app: nothing to do in a browser (the link opens its tab); in the installed
 * app the link is stopped and `url` goes to the system browser, with a toast when it cannot (the page's language).
 */
export function openExternalLink(url: string, event: Event): void {
  const invoke = (window as NativeWindow).__TAURI__?.core?.invoke;
  if (typeof invoke !== 'function') return;
  event.preventDefault();
  invoke(OPEN_EXTERNAL_COMMAND, { url }).catch((error: unknown) => {
    console.error('shell: open_external_url failed', error);
    void toastError(shellText('userMenu.openFailed'));
  });
}
