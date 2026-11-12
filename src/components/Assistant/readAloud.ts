// «Read aloud» of an answer: in the server voice the person chose (the host's `speak` gives its mp3), else in the
// device's own voice (`nativeVoice.ts`), which also reads when the server or its audio fails before a word was heard,
// never the whole answer again after a part. One reading at a time: a new one or «Stop reading» stops the one before and
// aborts its request. It fails, for the panel to say so, when nothing could read it or the server's audio broke halfway.
import type { AssistantSpeech } from './config';
import type { DeviceReader } from './deviceVoice';
import { type AssistantLanguage, DEVICE_VOICE } from './voices';

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
  /** Reads the text in `voice` (a catalogue id, empty for the server's own, or `DEVICE_VOICE`), stopping what was being read: it ends when the
   *  reading ends or is stopped, and fails when nothing could read it. Called in the click: the server's player is
   *  made and unlocked before anything is awaited. */
  read(text: string, language: AssistantLanguage, voice: string): Promise<void>;
  stop(): void;
}

const PAGE_URLS: AudioUrls = {
  create: (blob) => URL.createObjectURL(blob),
  revoke: (url) => URL.revokeObjectURL(url),
};

export function browserAudio(): (() => HTMLAudioElement) | undefined {
  return typeof globalThis.Audio === 'function' ? () => new Audio() : undefined;
}

/** The server's audio broke after part of it was heard: reading it again on the device would repeat that part. */
class HeardPartly extends Error {}

const SILENT_SAMPLES = 80;
let silentWav: Blob | null = null;

/** A silent WAV of 10 ms (8 kHz, 8-bit mono), made once: a `blob:`, which the hosts' CSP lets play (`media-src`). */
function silentClip(): Blob {
  if (silentWav) return silentWav;
  const buffer = new ArrayBuffer(44 + SILENT_SAMPLES);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + SILENT_SAMPLES, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true); // samples per second
  view.setUint32(28, 8000, true); // bytes per second
  view.setUint16(32, 1, true); // bytes per frame
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, SILENT_SAMPLES, true);
  new Uint8Array(buffer, 44).fill(128); // silence, in unsigned 8-bit
  silentWav = new Blob([buffer], { type: 'audio/wav' });
  return silentWav;
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

  /** Unlocks the player inside the click by playing the silent clip in it, synchronously: iOS lets a player start later
   *  (when the server's audio arrives) only if `play()` was called on it inside a gesture. Gives what frees the clip. */
  function unlock(player: HTMLAudioElement): () => void {
    const url = urls.create(silentClip());
    let freed = false;
    player.src = url;
    const refused = (error: unknown) => {
      // Not fatal: the server's audio is still tried, and a refusal of it is handled there.
      console.warn('assistant: the player could not be unlocked in the click', error);
    };
    try {
      void Promise.resolve(player.play()).catch(refused);
    } catch (error) {
      refused(error);
    }
    return () => {
      if (freed) return;
      freed = true;
      urls.revoke(url);
    };
  }

  /** Plays the server's audio: ends with it or when stopped, fails when it cannot start or breaks while it plays
   *  (`HeardPartly` once part of it was heard). `unlocked` frees the silent clip once the audio replaced it. */
  function play(player: HTMLAudioElement, blob: Blob, unlocked: () => void): Promise<void> {
    const url = urls.create(blob);
    return new Promise<void>((resolve, reject) => {
      let over = false;
      const end = (error?: unknown): void => {
        if (over) return;
        over = true;
        const heard = player.currentTime > 0;
        stopPlaying = null;
        player.onended = null;
        player.onerror = null;
        player.pause();
        player.removeAttribute('src');
        urls.revoke(url);
        if (error === undefined) resolve();
        else reject(heard ? new HeardPartly('assistant: the server voice broke while it played') : error);
      };
      stopPlaying = () => end();
      player.onended = () => end();
      player.onerror = () => end(new Error('assistant: the server voice could not be played'));
      player.src = url;
      unlocked();
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
    // Made and unlocked now, in the click, before anything is awaited: the server's audio arrives after it.
    const player = speak && voice !== DEVICE_VOICE && audio ? audio() : null;
    if (speak && player) {
      const unlocked = unlock(player);
      const request = new AbortController();
      // Stopped before the audio arrives: the request is aborted (the host passes `signal` to its fetch).
      const waiting = () => {
        request.abort();
        player.pause();
        unlocked();
      };
      stopPlaying = waiting;
      try {
        const blob = await speak({ text, language, voice, signal: request.signal });
        if (mine !== turn) return;
        await play(player, blob, unlocked);
        return;
      } catch (error) {
        if (mine !== turn) return;
        if (error instanceof HeardPartly) throw error;
        console.warn('assistant: the server voice failed, the device reads the answer', error);
      } finally {
        unlocked();
        if (stopPlaying === waiting) stopPlaying = null;
      }
    }
    if (!device) throw new Error('assistant: nothing on this device can read aloud');
    await device.read(text, language).done;
  }

  return { read, stop };
}
