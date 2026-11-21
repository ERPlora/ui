import { afterTheLoad, type NativeBridge, whileTheHubLands } from './native-bridge';

/** Where the device remembers that the person answered our sentence; devices already hold this name, so it stays. */
export const PRIMER_ANSWERED_KEY = 'erplora.notifications.primerAnswered';
/** The key of the plugin's status map that says whether Android lets the app show notices. */
export const ANDROID_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';

/**
 * What Android says about the notices: `false` refused, `true` allowed (also where there is no such permission to
 * give: an Android below 13, a computer), `null` unknown (no plugin, a read that failed or said nothing). Asked
 * again while the app says the hub is still landing, so the answer is the linked hub's.
 */
export async function noticesAllowed(bridge: NativeBridge, wait: (ms: number) => Promise<void>): Promise<boolean | null> {
  try {
    const status = (await whileTheHubLands(
      () => bridge.invoke('plugin:erplora-android|check_permissions'),
      wait,
    )) as Record<string, unknown> | null;
    return status ? status[ANDROID_NOTIFICATIONS] !== false : null;
  } catch {
    return null;
  }
}

export interface AskToNotifyDeps {
  bridge: NativeBridge | null;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  /** Shows our sentence; `true` for «Turn on notices», `false` for «Not now» (or dismissed). */
  confirm: () => Promise<boolean>;
  wait?: (ms: number) => Promise<void>;
}

/**
 * Asks Android to let the app notify, once per device and with our sentence first: only on an Android that has
 * the permission and has not given it, and never again by itself once the person answered. Never rejects.
 */
export async function askToNotify(deps: AskToNotifyDeps): Promise<void> {
  const { bridge, storage } = deps;
  if (!bridge || storage?.getItem(PRIMER_ANSWERED_KEY)) return;
  let status: Record<string, unknown> | null;
  try {
    status = (await whileTheHubLands(
      () => bridge.invoke('plugin:erplora-android|check_permissions'),
      deps.wait ?? afterTheLoad,
    )) as Record<string, unknown> | null;
  } catch {
    return; // a computer, or an app older than the plugin: nothing to ask for
  }
  if (status?.[ANDROID_NOTIFICATIONS] !== false) return;
  const allowed = await deps.confirm().catch(() => false);
  try {
    storage?.setItem(PRIMER_ANSWERED_KEY, '1');
  } catch (error) {
    console.warn('[device-notices] the device cannot remember the answer', error);
  }
  if (!allowed) return;
  try {
    await bridge.invoke('plugin:erplora-android|request_permissions', { permissions: [ANDROID_NOTIFICATIONS] });
  } catch (error) {
    console.warn('[device-notices] Android could not be asked', error);
  }
}
