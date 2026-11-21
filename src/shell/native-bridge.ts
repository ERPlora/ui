/** The installed app's leaves the page uses (`window.__TAURI__`). */
export interface NativeBridge {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
  addPluginListener?: (
    plugin: string,
    event: string,
    cb: (payload: unknown) => void,
  ) => Promise<{ unregister: () => Promise<void> }>;
  listen?: (event: string, cb: () => void) => Promise<() => void>;
}

/** What the app answers a page that is not the linked hub, or is but has not finished loading. */
export const NOT_THE_LINKED_HUB = 'not_the_linked_hub';
/** After the page's `load`, how long the app may still be saying `not_the_linked_hub`: about eight seconds. */
const LANDING_RETRIES_MS = [250, 500, 1000, 2000, 4000];

type TauriWindow = {
  __TAURI__?: {
    core?: { invoke?: NativeBridge['invoke']; addPluginListener?: NativeBridge['addPluginListener'] };
    event?: { listen?: NativeBridge['listen'] };
  };
};

/** The installed app's bridge, or `null` in a browser. */
export function nativeBridge(win: object = window): NativeBridge | null {
  const tauri = (win as TauriWindow).__TAURI__;
  const invoke = tauri?.core?.invoke;
  if (!invoke) return null;
  return { invoke, addPluginListener: tauri?.core?.addPluginListener, listen: tauri?.event?.listen };
}

/**
 * Tauri's own refusal of a command the installed app does not have, an app older than it: the ACL knows no such
 * permission, or no such command. Any other refusal is the app's, with a reason of its own.
 */
export function isOlderAppRefusal(error: unknown): boolean {
  const said = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  return /not found|not allowed/i.test(said);
}

const notLinkedYet = (error: unknown) =>
  error === NOT_THE_LINKED_HUB || (error instanceof Error && error.message === NOT_THE_LINKED_HUB);

/** Waits for the page's `load` (at once if it already happened), then `ms`. */
export function afterTheLoad(ms: number): Promise<void> {
  const loaded =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
  return loaded.then(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
}

/** Asks again while the app answers `not_the_linked_hub`; any other refusal comes back at once. */
export async function whileTheHubLands<T>(attempt: () => Promise<T>, wait: (ms: number) => Promise<void>): Promise<T> {
  for (const ms of LANDING_RETRIES_MS) {
    try {
      return await attempt();
    } catch (error) {
      if (!notLinkedYet(error)) throw error;
    }
    await wait(ms);
  }
  return attempt();
}
