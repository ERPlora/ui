// The voices here are made up: the package names none of its own.
import { describe, expect, it, vi } from 'vitest';

import { memoryStorage } from './__tests__/mount-assistant';
import * as module from './voices';
import { DEVICE_VOICE, type AssistantVoice, languageOf, readVoiceChoice, saveVoiceChoice, voiceKey, voicesFor } from './voices';

const LUCIA = 'es-lucia';
const MATEO = 'es-mateo';
const EMMA = 'en-emma';
const CATALOGUE: readonly AssistantVoice[] = [
  { id: LUCIA, name: 'Lucía', language: 'es' },
  { id: MATEO, name: 'Mateo', language: 'es' },
  { id: EMMA, name: 'Emma', language: 'en' },
];

describe('the catalogue of voices', () => {
  it('is not the package’s: it names no voice of its own, only the device’s choice', () => {
    expect(Object.keys(module)).not.toContain('ASSISTANT_VOICES');
    expect(DEVICE_VOICE).toBe('device');
  });

  it('gives the voices of a language, in the host’s order', () => {
    expect(voicesFor(CATALOGUE, 'es').map((voice) => voice.name)).toEqual(['Lucía', 'Mateo']);
    expect(voicesFor(CATALOGUE, 'en').map((voice) => voice.name)).toEqual(['Emma']);
    expect(voicesFor([], 'es')).toEqual([]);
  });

  it.each([
    ['es', 'es'],
    ['es-ES', 'es'],
    ['ES_es', 'es'],
    ['en', 'en'],
    ['en-GB', 'en'],
    ['fr', 'en'],
    ['', 'en'],
  ])('reads the language of the screen %j as %j (English where there is no voice of its own)', (locale, language) => {
    expect(languageOf(locale)).toBe(language);
  });
});

describe('the person’s choice of voice, per language, on this device', () => {
  const read = (storage: Storage | undefined, language: 'es' | 'en', device = true) =>
    readVoiceChoice(storage, language, { device, voices: CATALOGUE });

  it('is kept under `erplora.assistant.voice.<language>`', () => {
    expect(voiceKey('es')).toBe('erplora.assistant.voice.es');
    const storage = memoryStorage();
    saveVoiceChoice(storage, 'es', MATEO);
    saveVoiceChoice(storage, 'en', DEVICE_VOICE);
    expect(storage.getItem('erplora.assistant.voice.es')).toBe(MATEO);
    expect(storage.getItem('erplora.assistant.voice.en')).toBe(DEVICE_VOICE);
  });

  it('reads back what was chosen for each language, apart', () => {
    const storage = memoryStorage();
    saveVoiceChoice(storage, 'es', MATEO);
    expect(read(storage, 'es')).toBe(MATEO);
    expect(read(storage, 'en')).toBe(EMMA);
    saveVoiceChoice(storage, 'es', DEVICE_VOICE);
    expect(read(storage, 'es')).toBe(DEVICE_VOICE);
  });

  it('is the language’s first voice when nothing was chosen, nothing can be kept, or what was kept is not a voice of it', () => {
    expect(read(undefined, 'es')).toBe(LUCIA);
    const storage = memoryStorage();
    expect(read(storage, 'es')).toBe(LUCIA);
    storage.setItem('erplora.assistant.voice.es', EMMA);
    expect(read(storage, 'es')).toBe(LUCIA);
    storage.setItem('erplora.assistant.voice.es', 'es-gone');
    expect(read(storage, 'es')).toBe(LUCIA);
  });

  it('is the first voice, never the device’s, on a device that cannot read (the Android webview)', () => {
    const storage = memoryStorage();
    saveVoiceChoice(storage, 'es', DEVICE_VOICE);
    expect(read(storage, 'es', false)).toBe(LUCIA);
  });

  it('without voices for the language there is nothing to choose: no voice named, whatever the device keeps', () => {
    const storage = memoryStorage();
    saveVoiceChoice(storage, 'es', DEVICE_VOICE);
    expect(readVoiceChoice(storage, 'es', { device: true, voices: [] })).toBe('');
    expect(readVoiceChoice(undefined, 'en', { device: true, voices: [] })).toBe('');
    expect(readVoiceChoice(memoryStorage(), 'en', { device: true, voices: voicesFor(CATALOGUE, 'es') })).toBe('');
  });

  it('a storage that refuses (private mode, blocked): read as the first voice, a write that fails is told, never thrown', () => {
    const blocked = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    } as unknown as Storage;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(read(blocked, 'en')).toBe(EMMA);
      expect(() => saveVoiceChoice(blocked, 'en', DEVICE_VOICE)).not.toThrow();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
