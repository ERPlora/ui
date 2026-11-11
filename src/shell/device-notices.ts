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
//   dialog in the middle of the day; a computer and an Android below 13 have no such permission and send. The
//   app asks for it only when the page does (HUB_APP-F07, hub#1732): where the person has something to be told,
//   our sentence goes first («Let us keep you posted»), once per device — «Not now» is never asked again by
//   itself —, then Android's dialog for notices only (hub#758);
// - a tap opens the screen it is about (hub#2305): every notice goes out with a number of its own and its
//   screen, and the tap the page was not there to hear is claimed from the app (hub#2360), retried while the
//   app says the hub is still landing (hub#2658). Nothing here ever rejects: what it tells already happened;
// - with the screen off the app keeps listening (HUB_APP-F26, hub#836; the old hub's hub#2307): Android freezes
//   the page within minutes, so while somebody is signed in, has something to be told and the notices are not
//   refused, the page asks the app to stay listening with the ongoing notification Android requires («ERPlora
//   is listening»), as the order-taking apps for merchants do (Uber Eats Orders, Glovo Partners, Deliveroo
//   Restaurant Hub). It is decided after our sentence, so the answer to it counts, and stopped when the page
//   lets go or the person signs out (`stopNoticeListening`). An app without the command (the 1.1.34, which
//   dropped the foreground service, ERPlora/app#25) is noticed, written down once and not asked again.
import { alertController } from '@ionic/vue';
import { onBeforeUnmount, onMounted, type Ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
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
/** Where the device remembers that the person answered our sentence (the old hub's key). */
export const PRIMER_ANSWERED_KEY = 'erplora.notifications.primerAnswered';
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
/** The app's command that keeps it listening with the screen off (ERPlora/app, HUB_APP-F26). */
export const KEEP_LISTENING_COMMAND = 'plugin:erplora-android|keep_listening';
/** The words of the ongoing notification, in one place so the test checks `en` and `es`. */
export const NOTICE_LISTENING_COPY_KEYS = [
  'notices.listeningTitle',
  'notices.listeningBody',
  'notices.listeningChannel',
] as const;
/** How long a sign-out waits for the app to stop listening: a tap on «Sign out» always leaves. */
const STOP_WAIT_MS = 2000;

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

/**
 * What Android says about the notices: `false` refused, `true` allowed (also where there is no such permission to
 * give: an Android below 13, a computer), `null` unknown (no plugin, a read that failed or said nothing). Asked
 * again while the app says the hub is still landing (hub#2658), so the answer is the linked hub's.
 */
async function noticesAllowed(bridge: NativeBridge, wait: (ms: number) => Promise<void>): Promise<boolean | null> {
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
      // The first result of a reopened page often lands before the app lets it drive (hub#2658): the night's
      // bookings wait for the hub to land, they are not lost.
      const wait = deps.wait ?? afterTheLoad;
      // Only a refusal stops it: anything else (granted, not asked for here, no plugin) lets it go out.
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

/** Asks again while the app answers `not_the_linked_hub` (hub#2658); any other refusal comes back at once. */
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

export interface NoticeListeningDeps {
  bridge: NativeBridge | null;
  /** The words of the ongoing notification, in the person's language. */
  t: (key: string) => string;
  wait?: (ms: number) => Promise<void>;
}

export interface NoticeListening {
  /**
   * Listens when `wanted` (somebody signed in, with something to be told) and Android does not refuse the
   * notices; stops otherwise. Never rejects.
   */
  sync: (wanted: boolean) => Promise<void>;
}

const LISTENING_TAG = '[device-notices]';

export function createNoticeListening(deps: NoticeListeningDeps): NoticeListening {
  // Deciding waits for Android, and the session can close meanwhile: only the last request is carried out, so a
  // slow «start» never lands after the «stop» that followed it.
  let latest = 0;
  // The installed app has no such command (the 1.1.34): asking again on this page would only fail again.
  let withoutCommand = false;

  return {
    async sync(wanted) {
      const { bridge } = deps;
      if (!bridge || withoutCommand) return;
      const request = ++latest;
      const wait = deps.wait ?? afterTheLoad;
      // Not knowing whether the notices are allowed is no reason to keep the device awake.
      const on = wanted && (await noticesAllowed(bridge, wait)) === true;
      if (request !== latest) return;
      const args: Record<string, unknown> = on
        ? {
            on: true,
            title: deps.t('notices.listeningTitle'),
            body: deps.t('notices.listeningBody'),
            channel: deps.t('notices.listeningChannel'),
          }
        : { on: false };
      try {
        await whileTheHubLands(() => bridge.invoke(KEEP_LISTENING_COMMAND, args), wait);
      } catch (error) {
        if (isOlderAppRefusal(error)) {
          withoutCommand = true;
          console.warn(LISTENING_TAG, 'this app cannot keep listening with the screen off (older than the command)', error);
          return;
        }
        // Android may refuse a start: the notices keep arriving while the app is on screen, as before.
        console.warn(LISTENING_TAG, on ? 'the app could not start listening' : 'the app could not stop listening', error);
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
