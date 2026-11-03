// The assistant's voices (round 2026-11-03m): two server voices per language, the same catalogue the SaaS keeps in
// Python (their ids are the contract with the server), the device's own voice as the other choice, and the person's
// choice remembered by the device, one per language.
import { describe, expect, it, vi } from 'vitest';

import { memoryStorage } from './__tests__/mount-assistant';
import {
  ASSISTANT_VOICES,
  DEVICE_VOICE,
  defaultVoice,
  languageOf,
  readVoiceChoice,
  saveVoiceChoice,
  voiceKey,
  voicesFor,
} from './voices';

describe('the catalogue of voices', () => {
  it('names the server voices by the ids the server knows, two per language, a woman first', () => {
    expect(ASSISTANT_VOICES).toEqual([
      { id: 'es-ES-Ximena:DragonHDLatestNeural', name: 'Ximena', language: 'es', gender: 'female' },
      { id: 'es-ES-Tristan:DragonHDLatestNeural', name: 'Tristan', language: 'es', gender: 'male' },
      { id: 'en-US-Ava:DragonHDLatestNeural', name: 'Ava', language: 'en', gender: 'female' },
      { id: 'en-US-Andrew2:DragonHDLatestNeural', name: 'Andrew', language: 'en', gender: 'male' },
    ]);
    expect(DEVICE_VOICE).toBe('device');
  });

  it('gives the voices of a language and the first of them as its default', () => {
    expect(voicesFor('es').map((voice) => voice.name)).toEqual(['Ximena', 'Tristan']);
    expect(voicesFor('en').map((voice) => voice.name)).toEqual(['Ava', 'Andrew']);
    expect(defaultVoice('es').id).toBe('es-ES-Ximena:DragonHDLatestNeural');
    expect(defaultVoice('en').id).toBe('en-US-Ava:DragonHDLatestNeural');
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
  const XIMENA = 'es-ES-Ximena:DragonHDLatestNeural';
  const TRISTAN = 'es-ES-Tristan:DragonHDLatestNeural';
  const AVA = 'en-US-Ava:DragonHDLatestNeural';

  it('is kept under `erplora.assistant.voice.<language>`', () => {
    expect(voiceKey('es')).toBe('erplora.assistant.voice.es');
    const storage = memoryStorage();
    saveVoiceChoice(storage, 'es', TRISTAN);
    saveVoiceChoice(storage, 'en', DEVICE_VOICE);
    expect(storage.getItem('erplora.assistant.voice.es')).toBe(TRISTAN);
    expect(storage.getItem('erplora.assistant.voice.en')).toBe(DEVICE_VOICE);
  });

  it('reads back what was chosen for each language, apart', () => {
    const storage = memoryStorage();
    saveVoiceChoice(storage, 'es', TRISTAN);
    expect(readVoiceChoice(storage, 'es', { device: true })).toBe(TRISTAN);
    expect(readVoiceChoice(storage, 'en', { device: true })).toBe(AVA);
    saveVoiceChoice(storage, 'es', DEVICE_VOICE);
    expect(readVoiceChoice(storage, 'es', { device: true })).toBe(DEVICE_VOICE);
  });

  it('is the language’s default when nothing was chosen, nothing can be kept, or what was kept is not a voice of it', () => {
    expect(readVoiceChoice(undefined, 'es', { device: true })).toBe(XIMENA);
    const storage = memoryStorage();
    expect(readVoiceChoice(storage, 'es', { device: true })).toBe(XIMENA);
    storage.setItem('erplora.assistant.voice.es', AVA);
    expect(readVoiceChoice(storage, 'es', { device: true })).toBe(XIMENA);
    storage.setItem('erplora.assistant.voice.es', 'es-ES-Elvira:DragonHDLatestNeural');
    expect(readVoiceChoice(storage, 'es', { device: true })).toBe(XIMENA);
  });

  it('is the default, never the device’s voice, on a device that cannot read (the Android webview)', () => {
    const storage = memoryStorage();
    saveVoiceChoice(storage, 'es', DEVICE_VOICE);
    expect(readVoiceChoice(storage, 'es', { device: false })).toBe(XIMENA);
  });

  it('a storage that refuses (private mode, blocked): read as the default, a write that fails is told, never thrown', () => {
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
      expect(readVoiceChoice(blocked, 'en', { device: true })).toBe(AVA);
      expect(() => saveVoiceChoice(blocked, 'en', DEVICE_VOICE)).not.toThrow();
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
