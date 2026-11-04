// The device's voice, the system's first (round 2026-11-04a): in the installed app the system's own voice through the
// app's `tts_*` commands (the Android webview has no `speechSynthesis`), else the browser's; a reading the system voice
// cannot do is read by the browser's voice when there is one, else it fails for the panel to say so.
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeviceReader, DeviceReading } from './deviceVoice';
import {
  createDeviceVoice,
  type NativeInvoke,
  TTS_AVAILABLE_COMMAND,
  TTS_SPEAK_COMMAND,
  TTS_STOP_COMMAND,
} from './nativeVoice';

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

interface Deferred {
  resolve(value?: unknown): void;
  reject(error: unknown): void;
}

/** The installed app: whether it has a voice per language, and each reading it was asked for, left to end by hand. */
function fakeApp({ voices = { 'es-ES': true, 'en-US': true } as Record<string, boolean>, availableFails = false } = {}) {
  const speaking: Deferred[] = [];
  const calls: [string, Record<string, unknown> | undefined][] = [];
  const invoke = vi.fn<NativeInvoke>((command, args) => {
    calls.push([command, args]);
    if (command === TTS_AVAILABLE_COMMAND) {
      if (availableFails) return Promise.reject(new Error('Command tts_available not found'));
      return Promise.resolve({ available: voices[String(args?.language)] === true });
    }
    if (command === TTS_SPEAK_COMMAND) {
      return new Promise((resolve, reject) => speaking.push({ resolve, reject }));
    }
    if (command === TTS_STOP_COMMAND) {
      // Kotlin answers the reading it stopped as ended.
      speaking.splice(0).forEach((reading) => reading.resolve(null));
      return Promise.resolve(null);
    }
    return Promise.reject(new Error(`unknown command ${command}`));
  });
  const commands = () => calls.map(([command]) => command);
  return { invoke, calls, speaking, commands };
}

/** The browser's voice: each reading it was asked for, left to end by hand. */
function fakeBrowser() {
  const readings: { text: string; language: string; end: () => void; fail: (error: Error) => void; cancel: ReturnType<typeof vi.fn> }[] = [];
  const reader: DeviceReader = {
    read(text, language) {
      let end!: () => void;
      let fail!: (error: Error) => void;
      const done = new Promise<void>((resolve, reject) => {
        end = resolve;
        fail = reject;
      });
      const cancel = vi.fn(() => end());
      readings.push({ text, language, end, fail, cancel });
      return { done, cancel } satisfies DeviceReading;
    },
    cancel: vi.fn(() => readings.at(-1)?.cancel()),
  };
  return { reader, readings };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createDeviceVoice: the system voice first, the browser’s after it', () => {
  it('nothing to read with (no app, no browser voice): no device voice at all', () => {
    expect(createDeviceVoice({ invoke: null, browser: null })).toBeNull();
  });

  it('the app has a voice for the language: it reads the whole text in it, with the region (`es-ES`)', async () => {
    const app = fakeApp();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    const reading = voice.read('Hoy has  vendido\n120 €.', 'es');
    let ended = false;
    void reading.done.then(() => (ended = true));
    await flush();
    expect(app.calls).toEqual([
      [TTS_AVAILABLE_COMMAND, { language: 'es-ES' }],
      [TTS_SPEAK_COMMAND, { text: 'Hoy has vendido 120 €.', language: 'es-ES' }],
    ]);
    expect(ended).toBe(false);
    app.speaking[0].resolve(null);
    await flush();
    expect(ended).toBe(true);
  });

  it('reads English as `en-US`', async () => {
    const app = fakeApp();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    voice.read('Hello', 'en');
    await flush();
    expect(app.calls.at(-1)).toEqual([TTS_SPEAK_COMMAND, { text: 'Hello', language: 'en-US' }]);
  });

  it('the app has no voice for the language: the browser’s reads it, and the app is not asked to', async () => {
    const app = fakeApp({ voices: { 'es-ES': false } });
    const browser = fakeBrowser();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: browser.reader })!;
    const reading = voice.read('Hola', 'es');
    await flush();
    expect(app.commands()).toEqual([TTS_AVAILABLE_COMMAND]);
    expect(browser.readings.map(({ text, language }) => [text, language])).toEqual([['Hola', 'es']]);
    browser.readings[0].end();
    await expect(reading.done).resolves.toBeUndefined();
  });

  it('an app without the commands (older than this round) reads with the browser’s voice', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = fakeApp({ availableFails: true });
    const browser = fakeBrowser();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: browser.reader })!;
    voice.read('Hola', 'es');
    await flush();
    expect(browser.readings).toHaveLength(1);
    expect(app.commands()).not.toContain(TTS_SPEAK_COMMAND);
  });

  it('no app (a browser, the PWA): the browser’s voice reads at once, in the click, with nothing asked first', () => {
    const browser = fakeBrowser();
    const voice = createDeviceVoice({ invoke: null, browser: browser.reader })!;
    voice.read('Hola', 'es');
    // Synchronously: iOS Safari only lets the first utterance start inside the gesture.
    expect(browser.readings).toHaveLength(1);
  });

  it('the system voice fails while reading: the browser’s voice reads it when there is one', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = fakeApp();
    const browser = fakeBrowser();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: browser.reader })!;
    const reading = voice.read('Hola', 'es');
    await flush();
    app.speaking[0].reject('tts_failed');
    await flush();
    expect(browser.readings).toHaveLength(1);
    browser.readings[0].end();
    await expect(reading.done).resolves.toBeUndefined();
  });

  it('the system voice fails and there is no browser voice (the Android webview): the reading fails, to be said', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = fakeApp();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    const reading = voice.read('Hola', 'es');
    await flush();
    app.speaking[0].reject('tts_unavailable');
    await expect(reading.done).rejects.toThrow(/could not read aloud/);
  });

  it('no system voice for the language and no browser voice: the reading fails, to be said', async () => {
    const app = fakeApp({ voices: { 'es-ES': false } });
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    await expect(voice.read('Hola', 'es').done).rejects.toThrow(/could not read aloud/);
    expect(app.commands()).toEqual([TTS_AVAILABLE_COMMAND]);
  });

  it('the app is asked once per language whether it has a voice', async () => {
    const app = fakeApp();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    voice.read('Uno', 'es');
    await flush();
    app.speaking[0].resolve(null);
    voice.read('Dos', 'es');
    await flush();
    expect(await voice.canRead('es')).toBe(true);
    expect(app.commands().filter((command) => command === TTS_AVAILABLE_COMMAND)).toHaveLength(1);
  });

  it('a voice the app lost (`tts_unavailable`) is asked about again the next time', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = fakeApp();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    const first = voice.read('Uno', 'es');
    await flush();
    app.speaking[0].reject('tts_unavailable');
    await expect(first.done).rejects.toThrow();
    voice.read('Dos', 'es');
    await flush();
    expect(app.commands().filter((command) => command === TTS_AVAILABLE_COMMAND)).toHaveLength(2);
  });

  it('stopping stops the system voice and ends the reading', async () => {
    const app = fakeApp();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    const reading = voice.read('Hola', 'es');
    await flush();
    voice.cancel();
    expect(app.commands()).toContain(TTS_STOP_COMMAND);
    await expect(reading.done).resolves.toBeUndefined();
  });

  it('stopping a reading before the app was asked to read it: nothing is read, nothing to stop', async () => {
    const app = fakeApp();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    const reading = voice.read('Hola', 'es');
    reading.cancel();
    await flush();
    expect(app.commands()).toEqual([TTS_AVAILABLE_COMMAND]);
    await expect(reading.done).resolves.toBeUndefined();
  });

  it('a new reading is sent only once the stop of the one before was answered: the stop never silences it', async () => {
    let answerStop!: () => void;
    const app = fakeApp();
    const base = app.invoke.getMockImplementation()!;
    app.invoke.mockImplementation((command, args) => {
      if (command !== TTS_STOP_COMMAND) return base(command, args);
      app.calls.push([command, args]);
      return new Promise((resolve) => {
        answerStop = () => {
          app.speaking.splice(0).forEach((reading) => reading.resolve(null));
          resolve(null);
        };
      });
    });
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    voice.read('Primera', 'es');
    await flush();
    voice.read('Segunda', 'es');
    await flush();
    expect(app.commands()).toEqual([TTS_AVAILABLE_COMMAND, TTS_SPEAK_COMMAND, TTS_STOP_COMMAND]);
    answerStop();
    await flush();
    expect(app.calls.at(-1)).toEqual([TTS_SPEAK_COMMAND, { text: 'Segunda', language: 'es-ES' }]);
  });

  it('a stop the app refuses does not keep the next reading from being read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const app = fakeApp();
    const base = app.invoke.getMockImplementation()!;
    app.invoke.mockImplementation((command, args) =>
      command === TTS_STOP_COMMAND ? Promise.reject(new Error('not_the_linked_hub')) : base(command, args),
    );
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    voice.read('Primera', 'es');
    await flush();
    voice.read('Segunda', 'es');
    await flush();
    expect(app.calls.at(-1)).toEqual([TTS_SPEAK_COMMAND, { text: 'Segunda', language: 'es-ES' }]);
    expect(warn).toHaveBeenCalled();
  });

  it('stopping while the browser’s voice reads stops that one', async () => {
    const app = fakeApp({ voices: {} });
    const browser = fakeBrowser();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: browser.reader })!;
    const reading = voice.read('Hola', 'es');
    await flush();
    voice.cancel();
    expect(browser.readings[0].cancel).toHaveBeenCalled();
    await expect(reading.done).resolves.toBeUndefined();
    expect(app.commands()).not.toContain(TTS_STOP_COMMAND);
  });

  it('an empty text is read at once, with nothing sent to the app', async () => {
    const app = fakeApp();
    const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
    await expect(voice.read('  \n ', 'es').done).resolves.toBeUndefined();
    expect(app.commands()).not.toContain(TTS_SPEAK_COMMAND);
  });

  describe('canRead: whether to offer «Read aloud» and «Device voice»', () => {
    it('with the browser’s voice, at once, without asking the app', async () => {
      const app = fakeApp({ voices: {} });
      const voice = createDeviceVoice({ invoke: app.invoke, browser: fakeBrowser().reader })!;
      expect(voice.browser).toBe(true);
      await expect(voice.canRead('es')).resolves.toBe(true);
      expect(app.invoke).not.toHaveBeenCalled();
    });

    it('with only the app: what the app says of the language', async () => {
      const app = fakeApp({ voices: { 'es-ES': true, 'en-US': false } });
      const voice = createDeviceVoice({ invoke: app.invoke, browser: null })!;
      expect(voice.browser).toBe(false);
      await expect(voice.canRead('es')).resolves.toBe(true);
      await expect(voice.canRead('en')).resolves.toBe(false);
    });

    it('an app that cannot answer is no voice, and it never rejects', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const voice = createDeviceVoice({ invoke: fakeApp({ availableFails: true }).invoke, browser: null })!;
      await expect(voice.canRead('es')).resolves.toBe(false);
    });

    it('an answer that is not the app’s shape is no voice', async () => {
      for (const answer of [null, 'yes', {}, { available: 'true' }]) {
        const voice = createDeviceVoice({ invoke: async () => answer, browser: null })!;
        await expect(voice.canRead('es')).resolves.toBe(false);
      }
    });
  });
});
