import { afterTheLoad, isOlderAppRefusal, type NativeBridge, whileTheHubLands } from './native-bridge';
import { noticesAllowed } from './notice-permission';

/**
 * The app's command that keeps it listening with the screen off: Android freezes the page within minutes, so the app
 * holds the ongoing notification Android requires («ERPlora is listening»), as merchants' order-taking apps do.
 */
export const KEEP_LISTENING_COMMAND = 'plugin:erplora-android|keep_listening';
/** The words of the ongoing notification, in one place so the test checks `en` and `es`. */
export const NOTICE_LISTENING_COPY_KEYS = [
  'notices.listeningTitle',
  'notices.listeningBody',
  'notices.listeningChannel',
] as const;

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
