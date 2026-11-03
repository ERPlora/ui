// «Read aloud» of an answer (round 2026-11-03m): in the server's voice the person chose (the host's `speak` gives its
// mp3, played from a `blob:` URL freed as soon as it ends or fails), else in the device's own voice; a new reading or
// «Stop reading» stops the one before; it fails, to be told, only when neither the server nor the device could read.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AssistantSpeech } from './config';
import type { DeviceReader, DeviceReading } from './deviceVoice';
import { createReadAloud } from './readAloud';
import { DEVICE_VOICE } from './voices';

const XIMENA = 'es-ES-Ximena:DragonHDLatestNeural';

class FakeAudio {
  src = '';
  /** Where the audio has got to, in seconds (0 until anything was heard). */
  currentTime = 0;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  load = vi.fn();
  play = vi.fn(async () => {});
  pause = vi.fn();
  removeAttribute = vi.fn((name: string) => {
    if (name === 'src') this.src = '';
  });
}

let audios: FakeAudio[];
let urls: { create: ReturnType<typeof vi.fn>; revoke: ReturnType<typeof vi.fn> };
let warn: ReturnType<typeof vi.spyOn>;

/** A device that reads: each reading ends, fails or is cancelled when the test says. */
function fakeDevice() {
  const readings: { text: string; language: string; end: () => void; fail: () => void; cancelled: boolean }[] = [];
  const reader: DeviceReader & { read: ReturnType<typeof vi.fn> } = {
    read: vi.fn((text: string, language: string): DeviceReading => {
      let end!: () => void;
      let fail!: () => void;
      const done = new Promise<void>((resolve, reject) => {
        end = resolve;
        fail = () => reject(new Error('synthesis-failed'));
      });
      const entry = { text, language, end, fail, cancelled: false };
      readings.push(entry);
      return {
        done,
        cancel: () => {
          entry.cancelled = true;
          end();
        },
      };
    }),
    cancel: vi.fn(() => {
      for (const reading of readings) if (!reading.cancelled) {
        reading.cancelled = true;
        reading.end();
      }
    }),
  };
  return { reader, readings };
}

const flushAll = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

/** A server whose answer the test gives when it wants. */
function deferredSpeak() {
  let answer!: (blob: Blob) => void;
  let fail!: (error: Error) => void;
  const speak = vi.fn<(input: AssistantSpeech) => Promise<Blob>>(
    () =>
      new Promise<Blob>((resolve, reject) => {
        answer = resolve;
        fail = reject;
      }),
  );
  return { speak, answer: (blob: Blob) => answer(blob), fail: (error: Error) => fail(error) };
}

const MP3 = new Blob(['mp3'], { type: 'audio/mpeg' });

beforeEach(() => {
  audios = [];
  let made = 0;
  let silences = 0;
  urls = {
    // The silent clip that unlocks the player in the click, and the server's audio, each with its own URL.
    create: vi.fn((blob: Blob) => (blob.type === 'audio/wav' ? `blob:silence-${++silences}` : `blob:audio-${++made}`)),
    revoke: vi.fn(),
  };
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
});

function reader(
  options: {
    speak?: (input: AssistantSpeech) => Promise<Blob>;
    device?: DeviceReader | null;
    audio?: boolean;
    /** The page refuses to play the silent clip of the click (no gesture it counts). */
    refuseSilence?: boolean;
  } = {},
) {
  return createReadAloud({
    speak: options.speak,
    device: options.device === undefined ? fakeDevice().reader : options.device,
    audio:
      options.audio === false
        ? undefined
        : () => {
            const audio = new FakeAudio();
            if (options.refuseSilence) audio.play.mockRejectedValueOnce(new DOMException('not allowed', 'NotAllowedError'));
            audios.push(audio);
            return audio as unknown as HTMLAudioElement;
          },
    urls: urls as unknown as { create(blob: Blob): string; revoke(url: string): void },
  });
}

describe('in the server’s voice', () => {
  it('asks the host for the text in the chosen voice and plays its audio; the reading ends when the audio does', async () => {
    const server = deferredSpeak();
    const device = fakeDevice();
    const read = reader({ speak: server.speak, device: device.reader });
    let ended = false;
    const reading = read.read('Hoy has vendido 120 €.', 'es', XIMENA).then(() => (ended = true));
    expect(server.speak).toHaveBeenCalledWith({
      text: 'Hoy has vendido 120 €.',
      language: 'es',
      voice: XIMENA,
      signal: expect.any(AbortSignal),
    });
    server.answer(MP3);
    await flushAll();
    expect(urls.create).toHaveBeenCalledWith(MP3);
    expect(audios).toHaveLength(1);
    expect(audios[0].src).toBe('blob:audio-1');
    // The silent clip of the click, then the answer.
    expect(audios[0].play).toHaveBeenCalledTimes(2);
    expect(ended).toBe(false);
    expect(urls.revoke).not.toHaveBeenCalledWith('blob:audio-1');
    audios[0].onended?.();
    await reading;
    expect(ended).toBe(true);
    expect(urls.revoke).toHaveBeenCalledWith('blob:audio-1');
    expect(device.reader.read).not.toHaveBeenCalled();
  });

  it('its player is unlocked by playing a silent clip in the click itself, before anything is awaited (iOS Safari)', async () => {
    const server = deferredSpeak();
    void reader({ speak: server.speak }).read('Hola.', 'es', XIMENA);
    // Synchronously, still inside the click: only `play()` in a gesture unlocks a player on iOS.
    expect(audios).toHaveLength(1);
    expect(audios[0].play).toHaveBeenCalledTimes(1);
    expect(audios[0].src).toBe('blob:silence-1');
    const silence = urls.create.mock.calls[0][0] as Blob;
    expect(silence.type).toBe('audio/wav');
    expect(silence.size).toBeGreaterThan(44);
    server.answer(MP3);
    await flushAll();
    expect(audios).toHaveLength(1);
    expect(audios[0].src).toBe('blob:audio-1');
    expect(audios[0].play).toHaveBeenCalledTimes(2);
    expect(urls.revoke).toHaveBeenCalledWith('blob:silence-1');
  });

  it('a silent clip the page refuses to play does not stop the server’s audio from being tried', async () => {
    const server = deferredSpeak();
    const device = fakeDevice();
    const read = reader({ speak: server.speak, device: device.reader, refuseSilence: true });
    const reading = read.read('Hola.', 'es', XIMENA);
    await flushAll();
    server.answer(MP3);
    await flushAll();
    expect(audios[0].play).toHaveBeenCalledTimes(2);
    expect(audios[0].src).toBe('blob:audio-1');
    audios[0].onended?.();
    await expect(reading).resolves.toBeUndefined();
    expect(device.reader.read).not.toHaveBeenCalled();
  });

  it('stopped before the audio arrives: the request to the server is aborted and the silent clip is freed', async () => {
    const server = deferredSpeak();
    const read = reader({ speak: server.speak });
    void read.read('Hola.', 'es', XIMENA);
    const { signal } = server.speak.mock.calls[0][0] as { signal: AbortSignal };
    expect(signal.aborted).toBe(false);
    read.stop();
    expect(signal.aborted).toBe(true);
    expect(audios[0].pause).toHaveBeenCalled();
    expect(urls.revoke).toHaveBeenCalledWith('blob:silence-1');
  });

  it('the audio breaks after part of it was heard: never read again from the start on the device, and it is told', async () => {
    const server = deferredSpeak();
    const device = fakeDevice();
    const reading = reader({ speak: server.speak, device: device.reader }).read('Hola.', 'es', XIMENA);
    server.answer(MP3);
    await flushAll();
    audios[0].currentTime = 3.2;
    audios[0].onerror?.();
    await expect(reading).rejects.toThrow();
    expect(device.reader.read).not.toHaveBeenCalled();
    expect(urls.revoke).toHaveBeenCalledWith('blob:audio-1');
  });

  it('«Stop reading» while it plays: it stops, its audio is freed, the reading ends, the device is not asked', async () => {
    const server = deferredSpeak();
    const device = fakeDevice();
    const read = reader({ speak: server.speak, device: device.reader });
    const reading = read.read('Hola.', 'es', XIMENA);
    server.answer(MP3);
    await flushAll();
    read.stop();
    await expect(reading).resolves.toBeUndefined();
    expect(audios[0].pause).toHaveBeenCalled();
    expect(audios[0].src).toBe('');
    expect(urls.revoke).toHaveBeenCalledWith('blob:audio-1');
    expect(device.reader.read).not.toHaveBeenCalled();
  });

  it('a new reading stops the one playing before', async () => {
    const first = deferredSpeak();
    const read = reader({ speak: first.speak });
    const reading = read.read('Una.', 'es', XIMENA);
    first.answer(MP3);
    await flushAll();
    void read.read('Otra.', 'es', XIMENA);
    await expect(reading).resolves.toBeUndefined();
    expect(audios[0].pause).toHaveBeenCalled();
    expect(urls.revoke).toHaveBeenCalledWith('blob:audio-1');
    expect(audios).toHaveLength(2);
  });

  it('stopped before the audio arrives: the audio is never played and nothing is left behind', async () => {
    const server = deferredSpeak();
    const device = fakeDevice();
    const read = reader({ speak: server.speak, device: device.reader });
    const reading = read.read('Hola.', 'es', XIMENA);
    read.stop();
    server.answer(MP3);
    await expect(reading).resolves.toBeUndefined();
    expect(urls.create).not.toHaveBeenCalledWith(MP3);
    expect(audios[0].play).toHaveBeenCalledTimes(1);
    expect(audios[0].src).toBe('blob:silence-1');
    expect(urls.revoke).toHaveBeenCalledWith('blob:silence-1');
    expect(device.reader.read).not.toHaveBeenCalled();
  });
});

describe('the device’s voice as the fallback', () => {
  it.each([
    ['the server refuses (not configured, down)', 'speak'],
    ['the audio cannot start (autoplay refused)', 'play'],
    ['the audio fails while it plays', 'media'],
  ])('%s: the device reads it, and the audio is freed', async (_, where) => {
    const server = deferredSpeak();
    const device = fakeDevice();
    const read = reader({ speak: server.speak, device: device.reader });
    const reading = read.read('Hola.', 'es', XIMENA);
    if (where === 'play') audios[0].play.mockRejectedValueOnce(new DOMException('not allowed', 'NotAllowedError'));
    if (where === 'speak') server.fail(new Error('assistant.speech.not_configured'));
    else server.answer(MP3);
    await flushAll();
    if (where === 'media') audios[0].onerror?.();
    await flushAll();
    expect(device.reader.read).toHaveBeenCalledWith('Hola.', 'es');
    if (where !== 'speak') expect(urls.revoke).toHaveBeenCalledWith('blob:audio-1');
    expect(warn).toHaveBeenCalled();
    device.readings[0].end();
    await expect(reading).resolves.toBeUndefined();
  });

  it('the person chose the device’s voice: the server is never asked, nothing is downloaded', async () => {
    const server = deferredSpeak();
    const device = fakeDevice();
    const reading = reader({ speak: server.speak, device: device.reader }).read('Hola.', 'en', DEVICE_VOICE);
    await flushAll();
    expect(server.speak).not.toHaveBeenCalled();
    expect(audios).toHaveLength(0);
    expect(device.reader.read).toHaveBeenCalledWith('Hola.', 'en');
    device.readings[0].end();
    await expect(reading).resolves.toBeUndefined();
  });

  it('a host without a server voice, or a page that cannot play audio: the device reads', async () => {
    for (const options of [{ speak: undefined }, { speak: deferredSpeak().speak, audio: false }]) {
      const device = fakeDevice();
      void reader({ ...options, device: device.reader }).read('Hola.', 'es', XIMENA);
      await flushAll();
      expect(device.reader.read).toHaveBeenCalledWith('Hola.', 'es');
    }
    expect(audios).toHaveLength(0);
  });

  it('«Stop reading» while the device reads cancels it', async () => {
    const device = fakeDevice();
    const read = reader({ device: device.reader });
    const reading = read.read('Hola.', 'es', DEVICE_VOICE);
    await flushAll();
    read.stop();
    await expect(reading).resolves.toBeUndefined();
    expect(device.readings[0].cancelled).toBe(true);
  });
});

describe('never silent without saying so', () => {
  it('the server fails and the device cannot read (the Android webview): the reading fails', async () => {
    const server = deferredSpeak();
    const reading = reader({ speak: server.speak, device: null }).read('Hola.', 'es', XIMENA);
    server.fail(new Error('down'));
    await expect(reading).rejects.toThrow();
  });

  it('the device fails to read: the reading fails', async () => {
    const device = fakeDevice();
    const reading = reader({ device: device.reader }).read('Hola.', 'es', DEVICE_VOICE);
    await flushAll();
    device.readings[0].fail();
    await expect(reading).rejects.toThrow('synthesis-failed');
  });

  it('a reading stopped while the server fails is not told as a failure', async () => {
    const server = deferredSpeak();
    const read = reader({ speak: server.speak, device: null });
    const reading = read.read('Hola.', 'es', XIMENA);
    read.stop();
    server.fail(new Error('down'));
    await expect(reading).resolves.toBeUndefined();
  });
});
