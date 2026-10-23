// The device's notices (APPOINTMENT-F28; the old hub's HUB_SHELL-F66, HUB_APP-F24 and HUB_APP-F25): what the
// modules tell — a booking or a cancellation the customer made herself — goes out as a SYSTEM notice of the
// installed app, so the till hears it with the screen on another view or locked. The shell knows no module:
// the project hands it the live rows (`base.notice.list` in the hub, which fills in each module's texts) and
// this door tells each row once on this device.
//
// What is pinned:
// - once per device: a row is told by its key, id and instant (`at`), remembered in the device (`TOLD_KEY`), so
//   the next live result, a reconnection that brings the last 24 hours back or a reload never repeat it; a
//   device's first day only learns what is there (no burst of the last 24 hours);
// - only through the installed app (`erplora_notify`): a browser has the bell, and asks for no permission
//   (Fresha, Booksy, Square, Toast and Lightspeed warn on their app, not in the browser);
// - on Android, with the permission refused nothing is sent (HUB_APP-F24): the call would open Android's bare
//   dialog in the middle of the day; a computer and an Android below 13 have no such permission and send;
// - a tap opens the screen it is about (hub#2305): every notice goes out with a number of its own and its
//   screen, and the tap the page was not there to hear is claimed from the app (hub#2360), retried while the
//   app says the hub is still landing (hub#2658). Nothing here ever rejects: what it tells already happened.
import { onBeforeUnmount, onMounted, type Ref, watch } from 'vue';
import { useRouter } from 'vue-router';

/** A row to tell, as the project hands it: its key, the id and instant of what happened, and its texts. */
export interface DeviceNotice {
  key: string;
  id: string;
  at: string;
  title: string;
  body: string;
  /** The screen a tap opens. */
  route: string;
}

/** The installed app's leaves this door uses (`window.__TAURI__`). */
export interface NativeBridge {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
  addPluginListener?: (
    plugin: string,
    event: string,
    cb: (payload: unknown) => void,
  ) => Promise<{ unregister: () => Promise<void> }>;
  listen?: (event: string, cb: () => void) => Promise<() => void>;
}

/** Where the device remembers what it told. */
export const TOLD_KEY = 'erplora.notices.told';
/** How many notices the device remembers: the last 24 hours of a busy salon, with room to spare. */
export const REMEMBERED_TOLD = 200;
/** How many numbers the page remembers for the taps: a tap is on a recent notice. */
export const REMEMBERED_TAPS = 50;
/** The key of the plugin's status map that says whether Android lets the app show notices. */
export const ANDROID_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';
/** What the app answers a page that is not the linked hub, or is but has not finished loading. */
export const NOT_THE_LINKED_HUB = 'not_the_linked_hub';
/** The app's event that says a tap waits to be claimed (a click on the computer). */
export const NOTICE_TAPPED_EVENT = 'erplora://notice-tapped';
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

export interface NoticeDoorDeps {
  bridge: NativeBridge | null;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  navigate: (path: string) => unknown;
  /** A screen of this hub a notice may lead to. */
  isScreen: (path: string) => boolean;
  /** The first number handed out; from the clock, so a new page never reuses one still in the tray. */
  firstId?: number;
}

export interface NoticeDoor {
  /** Tells, oldest first, every row this device has not told yet. Never rejects. */
  tell: (notices: readonly DeviceNotice[]) => Promise<void>;
  /** What the plugin reports when a notice is tapped, or the tap the app kept. */
  tapped: (payload: unknown) => void;
}

const token = (notice: DeviceNotice) => `${notice.key}:${notice.id}:${notice.at}`;

/** What the device told, or `null` on its first day (nothing remembered, or a memory that does not read). */
function recall(storage: NoticeDoorDeps['storage']): string[] | null {
  try {
    const kept: unknown = JSON.parse(storage?.getItem(TOLD_KEY) ?? 'null');
    return Array.isArray(kept) ? kept.filter((item): item is string => typeof item === 'string') : null;
  } catch {
    return null;
  }
}

function remember(storage: NoticeDoorDeps['storage'], told: string[]): void {
  try {
    storage?.setItem(TOLD_KEY, JSON.stringify(told.slice(-REMEMBERED_TOLD)));
  } catch (error) {
    console.warn('[device-notices] the device cannot remember what it told', error);
  }
}

/** Android refused the permission; anything else (granted, not asked for here, no plugin) lets it go out. */
async function refused(bridge: NativeBridge): Promise<boolean> {
  try {
    const status = (await bridge.invoke('plugin:erplora-android|check_permissions')) as Record<string, unknown> | null;
    return status?.[ANDROID_NOTIFICATIONS] === false;
  } catch {
    return false;
  }
}

export function createNoticeDoor(deps: NoticeDoorDeps): NoticeDoor {
  const targets = new Map<number, string>();
  let next = deps.firstId ?? Math.floor(Date.now() / 1000) % 1_000_000_000;

  return {
    async tell(notices) {
      const { bridge, storage } = deps;
      if (!bridge) return;
      // Marked before anything is awaited: a second result arriving meanwhile finds them told.
      const told = recall(storage);
      const fresh = notices.filter((notice) => !told?.includes(token(notice)));
      remember(storage, [...(told ?? []), ...fresh.map(token)]);
      if (told === null || fresh.length === 0) return;
      if (await refused(bridge)) return;
      for (const notice of [...fresh].reverse()) {
        const id = next;
        next += 1;
        const path = deps.isScreen(notice.route) ? notice.route : null;
        try {
          await bridge.invoke('erplora_notify', { title: notice.title, body: notice.body, id, path });
        } catch (error) {
          console.warn('[device-notices] the app could not show a notice', error);
          continue;
        }
        if (path === null) continue;
        targets.set(id, path);
        if (targets.size > REMEMBERED_TAPS) targets.delete(targets.keys().next().value as number);
      }
    },
    tapped(payload) {
      const notification = (payload as { notification?: { id?: unknown; extra?: { path?: unknown } | null } } | null)
        ?.notification;
      if (typeof notification?.id !== 'number') return;
      // What this page remembers wins; a tap it did not see go out brings its own screen back.
      const brought = notification.extra?.path;
      const path = targets.get(notification.id) ?? (typeof brought === 'string' && deps.isScreen(brought) ? brought : undefined);
      if (!path) return;
      const failed = (error: unknown) => console.warn('[device-notices] the tap could not open its screen', error);
      try {
        void Promise.resolve(deps.navigate(path)).catch(failed);
      } catch (error) {
        failed(error);
      }
    },
  };
}

const notLinkedYet = (error: unknown) =>
  error === NOT_THE_LINKED_HUB || (error instanceof Error && error.message === NOT_THE_LINKED_HUB);

/** Waits for the page's `load` (at once if it already happened), then `ms`. */
function afterTheLoad(ms: number): Promise<void> {
  const loaded =
    document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise<void>((resolve) => window.addEventListener('load', () => resolve(), { once: true }));
  return loaded.then(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));
}

/** Asks again while the app answers `not_the_linked_hub` (hub#2658); any other refusal comes back at once. */
async function whileTheHubLands<T>(attempt: () => Promise<T>, wait: (ms: number) => Promise<void>): Promise<T> {
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

/**
 * Hands every tap to the door: the plugin's (`actionPerformed`), and the one the app kept for the page — claimed
 * now, for the tap that started the app, and again whenever the app says one waits. Returns what stops it.
 */
export async function bootNoticeTaps(
  door: NoticeDoor,
  bridge: NativeBridge | null,
  wait: (ms: number) => Promise<void> = afterTheLoad,
): Promise<() => void> {
  if (!bridge) return () => {};
  const stops: Array<() => void> = [];
  const { addPluginListener, listen } = bridge;
  if (addPluginListener) {
    try {
      const listener = await whileTheHubLands(
        () => addPluginListener('notification', 'actionPerformed', (payload) => door.tapped(payload)),
        wait,
      );
      stops.push(() => void listener.unregister().catch(() => {}));
    } catch (error) {
      console.warn('[device-notices] the taps cannot be heard here', error);
    }
  }
  const claim = async () => {
    try {
      const kept = await whileTheHubLands(() => bridge.invoke('erplora_take_notice_tap'), wait);
      if (kept) door.tapped(kept);
    } catch (error) {
      console.warn('[device-notices] the kept tap cannot be claimed here', error);
    }
  };
  if (listen) {
    try {
      stops.push(await listen(NOTICE_TAPPED_EVENT, () => void claim()));
    } catch (error) {
      console.warn('[device-notices] the app cannot say a tap waits here', error);
    }
  }
  await claim();
  return () => stops.forEach((stop) => stop());
}

/**
 * Tells on this device each new row of `notices` (the project's live rows) and opens the screen of a tapped one,
 * when this hub has it. For the component the project mounts as `chrome.background`.
 */
export function useDeviceNotices(notices: Ref<readonly DeviceNotice[] | undefined>): void {
  const router = useRouter();
  const bridge = nativeBridge();
  const door = createNoticeDoor({
    bridge,
    storage: globalThis.localStorage ?? null,
    navigate: (path) => router.push(path),
    isScreen: (path) =>
      path.startsWith('/') && !path.startsWith('//') && router.resolve(path).name !== 'not-found',
  });
  let stop: (() => void) | undefined;
  let gone = false;
  onMounted(() => {
    void bootNoticeTaps(door, bridge).then((stopTaps) => (gone ? stopTaps() : (stop = stopTaps)));
  });
  onBeforeUnmount(() => {
    gone = true;
    stop?.();
  });
  watch(
    notices,
    (rows) => {
      if (rows) void door.tell(rows);
    },
    { immediate: true },
  );
}
