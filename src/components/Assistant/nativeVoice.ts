// The device's voice. In the installed Android app the system's own voice reads, through the app's `tts_*` commands
// (Android's TextToSpeech), because the Android webview has no `speechSynthesis`. Everywhere else the browser's voice
// reads (`deviceVoice.ts`), the Windows app included: its WebView2 reads with Windows' voices, and the app answers that
// it has no system voice. A reading the system voice cannot do (no voice, the engine broke) falls back to the browser's
// voice when there is one; else it fails, for the panel to say so under the answer.
import type { NativeBridge } from '../../shell/device-notices';
import { DEVICE_LANGS, type DeviceReader, type DeviceReading } from './deviceVoice';
import type { AssistantLanguage } from './voices';

/** The app's commands for the system voice (plugin `erplora-android`). */
export const TTS_AVAILABLE_COMMAND = 'plugin:erplora-android|tts_available';
export const TTS_SPEAK_COMMAND = 'plugin:erplora-android|tts_speak';
export const TTS_STOP_COMMAND = 'plugin:erplora-android|tts_stop';

/** The app's refusal when its voice cannot read the language (any more). */
const TTS_UNAVAILABLE = 'tts_unavailable';

/** How the page calls the installed app (`nativeBridge().invoke`). */
export type NativeInvoke = NativeBridge['invoke'];

export interface DeviceVoice extends DeviceReader {
  /** Whether the device has the browser's voice: it reads without asking the app. */
  readonly browser: boolean;
  /** Whether the device can read the language aloud: the browser's voice, or the app's for it. Never rejects. */
  canRead(language: AssistantLanguage): Promise<boolean>;
}

export interface DeviceVoiceDeps {
  /** The installed app's bridge; none in a browser. */
  invoke: NativeInvoke | null;
  /** The browser's voice; none where the page has no `speechSynthesis` (the Android webview). */
  browser: DeviceReader | null;
}

const isAvailable = (answer: unknown): boolean =>
  typeof answer === 'object' && answer !== null && (answer as { available?: unknown }).available === true;

/** The device's voice, or none when it has nothing to read with. */
export function createDeviceVoice({ invoke, browser }: DeviceVoiceDeps): DeviceVoice | null {
  if (!invoke && !browser) return null;
  /** What the app answered for each language (`tts_available`), asked once. */
  const known = new Map<AssistantLanguage, boolean>();
  let current: DeviceReading | null = null;
  /** The last stop sent to the app, answered (or refused) before the next reading is sent: sent in the other order,
   *  the stop would silence the new reading. */
  let stopping: Promise<void> = Promise.resolve();

  async function systemReads(language: AssistantLanguage): Promise<boolean> {
    if (!invoke) return false;
    const kept = known.get(language);
    if (kept !== undefined) return kept;
    try {
      const available = isAvailable(await invoke(TTS_AVAILABLE_COMMAND, { language: DEVICE_LANGS[language] }));
      known.set(language, available);
      return available;
    } catch (error) {
      // Not kept: the page may be one the app does not serve yet (`not_the_linked_hub`).
      console.warn('assistant: the app has no system voice to read with', error);
      return false;
    }
  }

  function stopSystem(): void {
    if (!invoke) return;
    stopping = invoke(TTS_STOP_COMMAND).then(
      () => undefined,
      (error: unknown) => console.warn('assistant: the system voice could not be stopped', error),
    );
  }

  function readWithApp(app: NativeInvoke, text: string, language: AssistantLanguage): DeviceReading {
    let over = false;
    let speaking = false;
    let fallback: DeviceReading | null = null;
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const done = new Promise<void>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    const end = (error?: Error): void => {
      if (over) return;
      over = true;
      if (error) reject(error);
      else resolve();
    };
    const readInBrowser = (why: unknown): void => {
      if (over) return;
      if (!browser) {
        end(new Error(`assistant: the device could not read aloud (${String(why)})`));
        return;
      }
      fallback = browser.read(text, language);
      fallback.done.then(
        () => end(),
        (error: unknown) => end(error instanceof Error ? error : new Error(String(error))),
      );
    };
    const spoken = text.replace(/\s+/g, ' ').trim();
    void (async () => {
      if (!spoken) return end();
      if (!(await systemReads(language))) return readInBrowser('no system voice for the language');
      await stopping;
      if (over) return;
      speaking = true;
      try {
        await app(TTS_SPEAK_COMMAND, { text: spoken, language: DEVICE_LANGS[language] });
        speaking = false;
        end();
      } catch (error) {
        speaking = false;
        if (over) return;
        if (String(error).includes(TTS_UNAVAILABLE)) known.delete(language);
        console.warn('assistant: the system voice could not read the answer', error);
        readInBrowser(error);
      }
    })();
    return {
      done,
      cancel() {
        if (over) return;
        if (speaking) stopSystem();
        fallback?.cancel();
        end();
      },
    };
  }

  function read(text: string, language: AssistantLanguage): DeviceReading {
    current?.cancel();
    // Without the app the browser's voice is asked at once, inside the click: iOS only lets the first utterance start
    // in the gesture.
    current = invoke ? readWithApp(invoke, text, language) : browser!.read(text, language);
    return current;
  }

  return {
    browser: browser !== null,
    canRead: (language) => (browser ? Promise.resolve(true) : systemReads(language)),
    read,
    cancel: () => current?.cancel(),
  };
}
