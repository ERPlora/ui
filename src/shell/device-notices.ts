// What the modules tell (a booking or a cancellation the customer made herself) goes out as a system notice of the
// installed app, so the till hears it with the screen on another view or locked. The shell knows no module: the
// project hands it the live rows (`base.notice.list` in the hub) and each row is told once on this device. Only the
// installed app notifies; a browser has the bell. Nothing here ever rejects: what it tells already happened.
import { alertController } from '@ionic/vue';
import { onBeforeUnmount, onMounted, type Ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { afterTheLoad, type NativeBridge, nativeBridge, whileTheHubLands } from './native-bridge';
import { createNoticeListening, type NoticeListening } from './notice-listening';
import { askToNotify, noticesAllowed } from './notice-permission';

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

/**
 * Where the device remembers what it told, by key, id and instant, so a new live result, a reconnection that brings
 * the last 24 hours back or a reload never repeat a row. A device's first day only learns what is there.
 */
export const TOLD_KEY = 'erplora.notices.told';
/** How many notices the device remembers: the last 24 hours of a busy salon, with room to spare. */
export const REMEMBERED_TOLD = 200;
/** How many numbers the page remembers for the taps: a tap is on a recent notice. */
export const REMEMBERED_TAPS = 50;
/** The app's event that says a tap waits to be claimed (a click on the computer). */
export const NOTICE_TAPPED_EVENT = 'erplora://notice-tapped';
/** How long a sign-out waits for the app to stop listening: a tap on «Sign out» always leaves. */
const STOP_WAIT_MS = 2000;

export interface NoticeDoorDeps {
  bridge: NativeBridge | null;
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  navigate: (path: string) => unknown;
  /** A screen of this hub a notice may lead to. */
  isScreen: (path: string) => boolean;
  /** The first number handed out; from the clock, so a new page never reuses one still in the tray. */
  firstId?: number;
  /** How long to wait between the attempts while the app says the hub is still landing (tests). */
  wait?: (ms: number) => Promise<void>;
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
      // The first result of a reopened page often lands before the app lets it drive: the night's bookings wait for
      // the hub to land, they are not lost.
      const wait = deps.wait ?? afterTheLoad;
      // Only a refusal stops it, since the call would open Android's bare dialog in the middle of the day; anything
      // else (granted, not asked for here, no plugin) lets it go out.
      if ((await noticesAllowed(bridge, wait)) === false) return;
      for (const notice of [...fresh].reverse()) {
        const id = next;
        next += 1;
        const path = deps.isScreen(notice.route) ? notice.route : null;
        try {
          await whileTheHubLands(
            () => bridge.invoke('erplora_notify', { title: notice.title, body: notice.body, id, path }),
            wait,
          );
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

/** The listening of the mounted page, for the sign-out to stop. */
let pageListening: NoticeListening | null = null;

/**
 * Stops the listening of this page and waits for the app to say so: the sign-out calls it before leaving, because
 * afterwards this page is no longer the linked hub and the app refuses its orders. Waits `maxMs` at most, so a tap on
 * «Sign out» always leaves; a no-op where nothing listens (a browser, before the shell mounted). Never rejects.
 */
export async function stopNoticeListening(maxMs: number = STOP_WAIT_MS): Promise<void> {
  if (!pageListening) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<void>((resolve) => (timer = setTimeout(resolve, maxMs)));
  await Promise.race([pageListening.sync(false), waited]);
  clearTimeout(timer);
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

/** Our sentence in an alert of Ionic: «Not now» · «Turn on notices». */
async function confirmInAlert(t: (key: string) => string): Promise<boolean> {
  const alert = await alertController.create({
    header: t('notices.primerHeader'),
    message: t('notices.primerMessage'),
    buttons: [
      { text: t('notices.primerLater'), role: 'cancel' },
      { text: t('notices.primerAllow'), role: 'confirm' },
    ],
  });
  await alert.present();
  const { role } = await alert.onDidDismiss();
  return role === 'confirm';
}

/**
 * Tells on this device each new row of `notices` (the project's live rows) and opens the screen of a tapped one,
 * when this hub has it; while `ask` says the person has something to be told, asks Android once to let the app
 * notify and then keeps the app listening with the screen off, unless the notices are refused; stops it once
 * nothing is left to tell or the page lets go. For the component the project mounts as `chrome.background`, which
 * lives while somebody is signed in.
 */
export function useDeviceNotices(
  notices: Ref<readonly DeviceNotice[] | undefined>,
  options: { ask?: Ref<boolean | undefined> } = {},
): void {
  const router = useRouter();
  const { t } = useI18n();
  const bridge = nativeBridge();
  const storage = globalThis.localStorage ?? null;
  const door = createNoticeDoor({
    bridge,
    storage,
    navigate: (path) => router.push(path),
    isScreen: (path) =>
      path.startsWith('/') && !path.startsWith('//') && router.resolve(path).name !== 'not-found',
  });
  const listening = createNoticeListening({ bridge, t });
  pageListening = listening;
  let stop: (() => void) | undefined;
  let gone = false;
  onMounted(() => {
    void bootNoticeTaps(door, bridge).then((stopTaps) => (gone ? stopTaps() : (stop = stopTaps)));
  });
  onBeforeUnmount(() => {
    gone = true;
    stop?.();
    void listening.sync(false);
    if (pageListening === listening) pageListening = null;
  });
  watch(
    notices,
    (rows) => {
      if (rows) void door.tell(rows);
    },
    { immediate: true },
  );
  // `undefined` until the project knows whether there is something to tell: the app is asked nothing meanwhile, so
  // a reload never stops and restarts what the page before it left listening.
  const ask = () => (gone ? false : options.ask?.value);
  let asked: Promise<void> | undefined;
  watch(
    ask,
    async (now) => {
      if (now === undefined) return;
      if (now) {
        asked ??= askToNotify({ bridge, storage, confirm: () => confirmInAlert(t) });
        // The answer to our sentence counts: decided once it is given, with what is true by then.
        await asked;
      }
      void listening.sync(ask() === true);
    },
    { immediate: true },
  );
}
