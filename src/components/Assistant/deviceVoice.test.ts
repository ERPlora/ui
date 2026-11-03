// The device's own voice (`speechSynthesis`), the fallback of the server's and a choice of its own: the language with
// its region (`es-ES`, never `es`), the best voice the device has for it (the natural and online ones first, never the
// Spanish of America for Spain's), waited for when the device lists them late, and the text read in pieces of under
// 200 characters (desktop Chrome cuts its online Google voices after about 15 seconds), one after the other.
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createDeviceReader,
  DEVICE_LANGS,
  deviceEnv,
  deviceVoices,
  MAX_PIECE,
  pickDeviceVoice,
  speechPieces,
} from './deviceVoice';

interface FakeVoice {
  name: string;
  lang: string;
}

const v = (name: string, lang: string): FakeVoice => ({ name, lang });

class FakeUtterance {
  lang = '';
  voice: FakeVoice | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  constructor(public text: string) {}
}

/** A device that reads: what it was given to read, and its list of voices (empty until `voiceschanged` when late). */
function fakeDevice(voices: FakeVoice[], { late = false } = {}) {
  let listed = late ? [] : voices;
  const listeners = new Set<() => void>();
  const spoken: FakeUtterance[] = [];
  const synth = {
    speak: vi.fn((utterance: FakeUtterance) => void spoken.push(utterance)),
    cancel: vi.fn(),
    getVoices: vi.fn(() => listed),
    addEventListener: vi.fn((type: string, listener: () => void) => {
      if (type === 'voiceschanged') listeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: () => void) => {
      if (type === 'voiceschanged') listeners.delete(listener);
    }),
  };
  const env = { synth: synth as unknown as SpeechSynthesis, Utterance: FakeUtterance as unknown as typeof SpeechSynthesisUtterance };
  return {
    synth,
    env,
    spoken,
    listeners,
    /** The device lists its voices, as Chrome does a moment after the page loads. */
    list() {
      listed = voices;
      for (const listener of [...listeners]) listener();
    },
  };
}

const flushAll = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('the language of the device’s voice', () => {
  it('always carries its region', () => {
    expect(DEVICE_LANGS).toEqual({ es: 'es-ES', en: 'en-US' });
  });
});

describe('pickDeviceVoice: the best voice the device has for the language', () => {
  const SPANISH = [
    v('Microsoft Helena - Spanish (Spain)', 'es-ES'),
    v('Paulina', 'es-MX'),
    v('Google español de Estados Unidos', 'es-US'),
    v('Microsoft Sabina - Spanish (Latin America)', 'es-419'),
    v('Google español', 'es-ES'),
    v('Mónica (Enhanced)', 'es_ES'),
    v('Microsoft Alvaro (Natural) - Spanish (Spain)', 'es-ES'),
    v('Microsoft Elvira Online (Natural) - Spanish (Spain)', 'es-ES'),
    v('Samantha', 'en-US'),
  ];

  it('online natural > natural > Google > enhanced or premium > the rest', () => {
    const left = [...SPANISH];
    const picks: string[] = [];
    for (;;) {
      const pick = pickDeviceVoice(left, 'es');
      if (!pick) break;
      picks.push(pick.name);
      left.splice(left.indexOf(pick), 1);
    }
    expect(picks).toEqual([
      'Microsoft Elvira Online (Natural) - Spanish (Spain)',
      'Microsoft Alvaro (Natural) - Spanish (Spain)',
      'Google español',
      'Mónica (Enhanced)',
      'Microsoft Helena - Spanish (Spain)',
    ]);
  });

  it('never the Spanish of the United States, Mexico or Latin America for Spain’s, even when it is the only one', () => {
    expect(pickDeviceVoice([v('Paulina', 'es-MX'), v('Google español de Estados Unidos', 'es-US'), v('Sabina', 'es-419')], 'es')).toBeNull();
    expect(pickDeviceVoice([v('Paulina', 'es-MX'), v('Jorge', 'es_ES')], 'es')?.name).toBe('Jorge');
  });

  it('a premium voice is ranked as an enhanced one, above a plain one of the screen’s own region', () => {
    expect(pickDeviceVoice([v('Samantha', 'en-US'), v('Zoe (Premium)', 'en-GB')], 'en')?.name).toBe('Zoe (Premium)');
  });

  it('English: any English voice, the region of the screen first between two alike', () => {
    const english = [v('Google UK English Female', 'en-GB'), v('Google US English', 'en-US'), v('Google español', 'es-ES')];
    expect(pickDeviceVoice(english, 'en')?.name).toBe('Google US English');
    expect(pickDeviceVoice([v('Daniel', 'en-GB'), v('Google español', 'es-ES')], 'en')?.name).toBe('Daniel');
  });

  it('none when the device has no voice of the language', () => {
    expect(pickDeviceVoice([v('Samantha', 'en-US')], 'es')).toBeNull();
    expect(pickDeviceVoice([], 'en')).toBeNull();
  });
});

describe('speechPieces: the text in pieces of under 200 characters, by sentences', () => {
  it('a short answer is one piece', () => {
    expect(speechPieces('Hoy has vendido 120 €. ¿Algo más?')).toEqual(['Hoy has vendido 120 €. ¿Algo más?']);
    expect(speechPieces('   ')).toEqual([]);
  });

  it('a long one, sentences together up to the limit, never cut in the middle of one, nothing lost', () => {
    const sentences = Array.from({ length: 12 }, (_, i) => `Esta es la frase número ${i + 1}, que cuenta algo del negocio de hoy.`);
    const text = sentences.join(' ');
    const pieces = speechPieces(text);
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) {
      expect(piece.length).toBeLessThanOrEqual(MAX_PIECE);
      expect(piece).toMatch(/\.$/);
    }
    expect(pieces.join(' ')).toBe(text);
  });

  it('a point inside a number or a closing mark stays with its sentence', () => {
    const first = `El total es 3.5 € más IVA, que hace ${'x'.repeat(150)} en caja.`;
    const second = '«Hecho.» Y la siguiente frase sigue.';
    expect(speechPieces(`${first} ${second}`)).toEqual([first, second]);
  });

  it('a sentence longer than the limit is cut at a comma, else at a space, else where it reaches it', () => {
    const clauses = Array.from({ length: 8 }, (_, i) => `cláusula ${i + 1} con unas cuantas palabras más`);
    const long = `${clauses.join(', ')}.`;
    const pieces = speechPieces(long);
    expect(pieces.length).toBeGreaterThan(1);
    for (const piece of pieces) expect(piece.length).toBeLessThanOrEqual(MAX_PIECE);
    expect(pieces[0]).toMatch(/,$/);
    expect(pieces.join(' ')).toBe(long);

    const words = Array.from({ length: 60 }, () => 'palabra').join(' ');
    for (const piece of speechPieces(words)) expect(piece.length).toBeLessThanOrEqual(MAX_PIECE);
    expect(speechPieces(words).join(' ')).toBe(words);

    const unbroken = 'a'.repeat(450);
    expect(speechPieces(unbroken)).toEqual(['a'.repeat(200), 'a'.repeat(200), 'a'.repeat(50)]);
  });
});

describe('deviceVoices: the device’s list, waited for when it comes late', () => {
  it('at once when the device already lists them', async () => {
    const device = fakeDevice([v('Google español', 'es-ES')]);
    await expect(deviceVoices(device.env.synth)).resolves.toHaveLength(1);
    expect(device.synth.addEventListener).not.toHaveBeenCalled();
  });

  it('after `voiceschanged` when the first list is empty (Chrome), and it stops listening', async () => {
    const device = fakeDevice([v('Google español', 'es-ES')], { late: true });
    const voices = deviceVoices(device.env.synth);
    await flushAll();
    expect(device.listeners.size).toBe(1);
    device.list();
    await expect(voices).resolves.toHaveLength(1);
    expect(device.listeners.size).toBe(0);
  });

  it('empty after a while when the device never lists any (it reads with the language alone)', async () => {
    vi.useFakeTimers();
    const device = fakeDevice([], { late: true });
    const voices = deviceVoices(device.env.synth, 1000);
    vi.advanceTimersByTime(1000);
    await expect(voices).resolves.toEqual([]);
    expect(device.listeners.size).toBe(0);
  });

  it('empty from a device without a list', async () => {
    await expect(deviceVoices({ speak() {}, cancel() {} } as unknown as SpeechSynthesis)).resolves.toEqual([]);
  });
});

describe('deviceEnv: the device’s voice, where it has one', () => {
  it('none without `speechSynthesis` or `SpeechSynthesisUtterance` (the Android webview)', () => {
    const device = fakeDevice([]);
    vi.stubGlobal('speechSynthesis', device.synth);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    expect(deviceEnv()).toEqual({ synth: device.synth, Utterance: FakeUtterance });
    vi.stubGlobal('speechSynthesis', undefined);
    expect(deviceEnv()).toBeNull();
    vi.stubGlobal('speechSynthesis', device.synth);
    vi.stubGlobal('SpeechSynthesisUtterance', undefined);
    expect(deviceEnv()).toBeNull();
  });
});

describe('createDeviceReader: reads a text in the device’s voice', () => {
  const VOICES = [v('Paulina', 'es-MX'), v('Google español', 'es-ES'), v('Samantha', 'en-US')];
  const LONG = Array.from({ length: 10 }, (_, i) => `Frase ${i + 1} de una respuesta bastante larga del asistente.`).join(' ');

  it('in its best voice for the language, with the region, piece after piece, and it ends after the last', async () => {
    const device = fakeDevice(VOICES);
    const reader = createDeviceReader(device.env);
    let ended = false;
    const reading = reader.read(LONG, 'es');
    void reading.done.then(() => (ended = true));
    await flushAll();
    const pieces = speechPieces(LONG);
    expect(pieces.length).toBeGreaterThan(1);
    expect(device.spoken).toHaveLength(1);
    expect(device.spoken[0]).toMatchObject({ text: pieces[0], lang: 'es-ES', voice: { name: 'Google español' } });
    for (let i = 1; i < pieces.length; i++) {
      device.spoken[i - 1].onend?.();
      expect(device.spoken).toHaveLength(i + 1);
      expect(device.spoken[i]).toMatchObject({ text: pieces[i], lang: 'es-ES' });
    }
    await flushAll();
    expect(ended).toBe(false);
    device.spoken.at(-1)?.onend?.();
    await flushAll();
    expect(ended).toBe(true);
  });

  it('a device left with something in its queue starts clean before the first piece', async () => {
    const device = fakeDevice(VOICES);
    createDeviceReader(device.env).read('Hola.', 'es');
    await flushAll();
    expect(device.synth.cancel).toHaveBeenCalledTimes(1);
    expect(device.synth.cancel.mock.invocationCallOrder[0]).toBeLessThan(device.synth.speak.mock.invocationCallOrder[0]);
  });

  it('keeps the voice it chose for the language: the device is asked for its list once', async () => {
    const device = fakeDevice(VOICES);
    const reader = createDeviceReader(device.env);
    reader.read('Hola.', 'es');
    await flushAll();
    device.spoken[0].onend?.();
    reader.read('Adiós.', 'es');
    await flushAll();
    expect(device.spoken[1]).toMatchObject({ text: 'Adiós.', voice: { name: 'Google español' } });
    expect(device.synth.getVoices).toHaveBeenCalledTimes(1);
  });

  it('without a voice of the language, the device reads with the language alone', async () => {
    const device = fakeDevice([v('Samantha', 'en-US')]);
    createDeviceReader(device.env).read('Hola.', 'es');
    await flushAll();
    expect(device.spoken[0]).toMatchObject({ text: 'Hola.', lang: 'es-ES', voice: null });
  });

  it('cancelled: the device stops, no other piece is read, and the reading ends', async () => {
    const device = fakeDevice(VOICES);
    const reader = createDeviceReader(device.env);
    const reading = reader.read(LONG, 'es');
    await flushAll();
    const before = device.synth.cancel.mock.calls.length;
    reading.cancel();
    expect(device.synth.cancel).toHaveBeenCalledTimes(before + 1);
    device.spoken[0].onerror?.({ error: 'interrupted' });
    device.spoken[0].onend?.();
    await expect(reading.done).resolves.toBeUndefined();
    expect(device.spoken).toHaveLength(1);
  });

  it('a new reading cancels the one before', async () => {
    const device = fakeDevice(VOICES);
    const reader = createDeviceReader(device.env);
    const first = reader.read(LONG, 'es');
    await flushAll();
    reader.read('Otra.', 'es');
    await expect(first.done).resolves.toBeUndefined();
    await flushAll();
    expect(device.spoken.map((utterance) => utterance.text)).toEqual([speechPieces(LONG)[0], 'Otra.']);
  });

  it('a piece the device fails to read: the reading fails with its reason', async () => {
    const device = fakeDevice(VOICES);
    const reading = createDeviceReader(device.env).read('Hola.', 'es');
    await flushAll();
    device.spoken[0].onerror?.({ error: 'synthesis-failed' });
    await expect(reading.done).rejects.toThrow('synthesis-failed');
  });

  it('cancelled while the device lists its voices: nothing is read', async () => {
    const device = fakeDevice(VOICES, { late: true });
    const reading = createDeviceReader(device.env).read('Hola.', 'es');
    await flushAll();
    reading.cancel();
    device.list();
    await expect(reading.done).resolves.toBeUndefined();
    await flushAll();
    expect(device.spoken).toEqual([]);
  });
});
