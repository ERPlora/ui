// «Read aloud» of an answer (round 2026-11-03m): in the server's voice the person chose — the host's `speak` gives
// its mp3 (Azure AI Speech), played from a `blob:` URL that is freed as soon as it ends, fails or is stopped —, else
// in the device's own voice (`deviceVoice.ts`): when the person chose it, when the host has no server voice, or when
// the server or its audio fails. One reading at a time: a new one or «Stop reading» stops the one before. It fails,
// for the panel to say so, only when neither the server nor the device could read it (the Android webview has no
// `speechSynthesis`); never silent without a word.
import type { AssistantSpeech } from './config';
import type { DeviceReader } from './deviceVoice';
import { type AssistantLanguage, DEVICE_VOICE } from './voices';

/** Where a `blob:` URL is made and freed (the page's `URL`). */
export interface AudioUrls {
  create(blob: Blob): string;
  revoke(url: string): void;
}

export interface ReadAloudDeps {
  /** The server's voice (`AssistantConfig.speak`); none: the device reads. */
  speak?: (input: AssistantSpeech) => Promise<Blob>;
  /** The device's voice; none where the device cannot read. */
  device: DeviceReader | null;
  /** Makes the player of the server's audio; none where the page cannot play audio. */
  audio?: () => HTMLAudioElement;
  urls?: AudioUrls;
}

export interface ReadAloud {
  /** Reads the text in `voice` (a catalogue id, or `DEVICE_VOICE`), stopping what was being read: it ends when the
   *  reading ends or is stopped, and fails when nothing could read it. Called in the click: the server's player is
   *  made and unlocked before anything is awaited. */
  read(text: string, language: AssistantLanguage, voice: string): Promise<void>;
  /** Stops what is being read, if anything. */
  stop(): void;
}

const PAGE_URLS: AudioUrls = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
};

/** The page's audio player, where it has one. */
export function browserAudio(): (() => HTMLAudioElement) | undefined {
  return typeof globalThis.Audio === 'function' ? () => new Audio() : undefined;
}

export function createReadAloud({ speak, device, audio, urls = PAGE_URLS }: ReadAloudDeps): ReadAloud {
  /** Which reading is the current one: what an older one gets later (an audio, a failure) is dropped. */
  let turn = 0;
  let stopPlaying: (() => void) | null = null;

  function stop(): void {
    turn += 1;
    stopPlaying?.();
    device?.cancel();
  }

  /** Plays the server's audio: ends with it or when stopped, fails when it cannot start or breaks while it plays. */
  function play(player: HTMLAudioElement, blob: Blob): Promise<void> {
    const url = urls.create(blob);
    return new Promise<void>((resolve, reject) => {
      let over = false;
      const end = (error?: unknown): void => {
        if (over) return;
        over = true;
        stopPlaying = null;
        player.onended = null;
        player.onerror = null;
        player.pause();
        player.removeAttribute('src');
        urls.revoke(url);
        if (error === undefined) resolve();
        else reject(error);
      };
      stopPlaying = () => end();
      player.onended = () => end();
      player.onerror = () => end(new Error('assistant: the server voice could not be played'));
      player.src = url;
      const refused = (error: unknown) => end(error ?? new Error('assistant: the server voice could not start'));
      try {
        void Promise.resolve(player.play()).catch(refused);
      } catch (error) {
        refused(error);
      }
    });
  }

  async function read(text: string, language: AssistantLanguage, voice: string): Promise<void> {
    stop();
    const mine = turn;
    // Made and unlocked now, in the click (`load()` in a gesture): Safari and the Android webview let a player start
    // later only when a gesture unlocked it, and the server's audio arrives after the click.
    const player = speak && voice !== DEVICE_VOICE && audio ? audio() : null;
    if (speak && player) {
      player.load();
      try {
        const blob = await speak({ text, language, voice });
        if (mine !== turn) return;
        await play(player, blob);
        return;
      } catch (error) {
        if (mine !== turn) return;
        console.warn('assistant: the server voice failed, the device reads the answer', error);
      }
    }
    if (!device) throw new Error('assistant: nothing on this device can read aloud');
    await device.read(text, language).done;
  }

  return { read, stop };
}
