// A link that leaves the app (the hub's «My account», «Report a problem» and «erplora.com» of the bar): a browser
// opens it in a new tab by itself (`target="_blank" rel="noopener"`); the installed app opens nothing on
// `target=_blank`, so the address goes to the system browser (`open_external_url`, which only takes our own
// addresses) and a refusal is said, never a button that does nothing (gh:hub#475).
import { afterEach, describe, expect, it, vi } from 'vitest';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('./toast', () => ({ toastError }));

import { OPEN_EXTERNAL_COMMAND, openExternalLink } from './open-external';

type TauriWindow = { __TAURI__?: { core?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> } } };

const URL = 'https://erplora.com/dashboard/businesses/0190';

function click(): MouseEvent {
  return new MouseEvent('click', { bubbles: true, cancelable: true });
}

afterEach(() => {
  delete (window as TauriWindow).__TAURI__;
  document.documentElement.lang = '';
  toastError.mockReset();
  vi.restoreAllMocks();
});

describe('openExternalLink', () => {
  it('names the command of the installed app', () => {
    expect(OPEN_EXTERNAL_COMMAND).toBe('open_external_url');
  });

  it('in a browser leaves the link to open its own new tab', async () => {
    const event = click();
    openExternalLink(URL, event);
    await Promise.resolve();
    expect(event.defaultPrevented).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('with a bridge that cannot invoke (an older app) leaves the link alone too', () => {
    (window as TauriWindow).__TAURI__ = { core: {} };
    const event = click();
    openExternalLink(URL, event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('in the installed app hands the address to the system browser instead of the webview', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    (window as TauriWindow).__TAURI__ = { core: { invoke } };
    const event = click();
    openExternalLink(URL, event);
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('open_external_url', { url: URL }));
    expect(event.defaultPrevented).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('when the app refuses or fails, says so in the language of the page', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    (window as TauriWindow).__TAURI__ = { core: { invoke: vi.fn().mockRejectedValue('external_url_refused') } };
    openExternalLink(URL, click());
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not open that page. Try again.'));
    expect(logged).toHaveBeenCalled();

    document.documentElement.lang = 'es';
    toastError.mockReset();
    openExternalLink(URL, click());
    await vi.waitFor(() => expect(toastError).toHaveBeenCalledWith('No se ha podido abrir esa página. Inténtalo de nuevo.'));
  });
});
