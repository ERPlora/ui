import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

import { configure, flush, memoryStorage, mountAssistant } from './__tests__/mount-assistant';
import { type AssistantConfig, configureAssistant } from './config';
import type { Bubble } from './history';
import { TTS_AVAILABLE_COMMAND, TTS_SPEAK_COMMAND, TTS_STOP_COMMAND } from './nativeVoice';
import { useReadAloud } from './useReadAloud';

type TauriWindow = { __TAURI__?: unknown };

const bubble = (id: string, text: string): Bubble => ({ id, role: 'assistant', text, files: [], notices: [], done: true });
const ANSWER = bubble('b1', 'Hoy has vendido 120 €.');
const CATALOGUE = [
  { id: 'es-lucia', name: 'Lucía', language: 'es' as const },
  { id: 'es-mateo', name: 'Mateo', language: 'es' as const },
  { id: 'en-emma', name: 'Emma', language: 'en' as const },
];

/** The installed app's voice (the Android webview has no `speechSynthesis`): the languages it reads, and its readings,
 *  left to end by hand. */
let reads: Record<string, boolean>;
let readings: { resolve: (value: unknown) => void; reject: (error: unknown) => void }[];
let invoke: Mock<(command: string, args?: Record<string, unknown>) => Promise<unknown>>;

beforeEach(() => {
  reads = { 'es-ES': true, 'en-US': true };
  readings = [];
  invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
    if (command === TTS_AVAILABLE_COMMAND) return { available: reads[String(args?.language)] === true };
    if (command === TTS_SPEAK_COMMAND) return new Promise((resolve, reject) => readings.push({ resolve, reject }));
    if (command === TTS_STOP_COMMAND) readings.splice(0).forEach((reading) => reading.resolve(null));
    return null;
  });
  (window as TauriWindow).__TAURI__ = { core: { invoke } };
  vi.stubGlobal('speechSynthesis', undefined);
  vi.stubGlobal('localStorage', memoryStorage());
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete (window as TauriWindow).__TAURI__;
  configureAssistant(undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const spoken = () => invoke.mock.calls.filter(([command]) => command === TTS_SPEAK_COMMAND).map(([, args]) => args);

async function reading(config: Partial<AssistantConfig> = {}, { open = true } = {}) {
  configure(config);
  const isOpen = ref(open);
  let read!: ReturnType<typeof useReadAloud>;
  const Host = defineComponent({
    setup() {
      read = useReadAloud({ open: () => isOpen.value, nameOf: (path) => (path === '/settings' ? 'Ajustes' : undefined) });
      return () => h('div');
    },
  });
  const m = await mountAssistant(Host, { locale: 'es' });
  await flush();
  return { ...m, read, isOpen };
}

describe('useReadAloud', () => {
  it('a host that turns it off: nothing to read with, nothing to choose, and «Read aloud» does nothing', async () => {
    const { read } = await reading({ readAloud: false, voices: CATALOGUE, speak: vi.fn() });
    expect([read.canSpeak.value, read.voiceOptions.value]).toEqual([false, []]);
    read.listen(ANSWER);
    await flush();
    expect(read.speaking.value).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('reads the answer as it is said (a screen’s path, by its name) and holds it as the one read until it ends', async () => {
    const { read } = await reading();
    expect(read.canSpeak.value).toBe(true);
    read.listen(bubble('b2', 'Míralo en /settings.'));
    await flush();
    expect(spoken()).toEqual([{ text: 'Míralo en Ajustes.', language: 'es-ES' }]);
    expect(read.speaking.value).toBe('b2');
    readings[0].resolve(null);
    await flush();
    expect(read.speaking.value).toBeNull();
  });

  it('pressed again on the answer being read: it stops, and is not read again', async () => {
    const { read } = await reading();
    read.listen(ANSWER);
    await flush();
    read.listen(ANSWER);
    await flush();
    expect(invoke.mock.calls.map(([command]) => command)).toContain(TTS_STOP_COMMAND);
    expect(spoken()).toHaveLength(1);
    expect(read.speaking.value).toBeNull();
  });

  it('a reading that fails is said under its answer until the next «Read aloud»', async () => {
    const { read } = await reading();
    read.listen(ANSWER);
    await flush();
    readings[0].reject('tts_failed');
    await flush();
    expect([read.speaking.value, read.failedRead.value]).toEqual([null, 'b1']);
    read.listen(ANSWER);
    expect(read.failedRead.value).toBeNull();
  });

  it('the app is asked whether it reads the language only once the panel opens', async () => {
    reads = {};
    const { read, isOpen } = await reading({}, { open: false });
    expect(invoke).not.toHaveBeenCalled();
    isOpen.value = true;
    await flush();
    expect(invoke).toHaveBeenCalledWith(TTS_AVAILABLE_COMMAND, { language: 'es-ES' });
    expect(read.canSpeak.value).toBe(false);
  });

  it('with server voices: the language’s and the device’s to choose, the choice kept, and one not offered ignored', async () => {
    const { read } = await reading({ voices: CATALOGUE, speak: vi.fn() });
    expect(read.voiceOptions.value).toEqual([
      { id: 'es-lucia', label: 'Lucía' },
      { id: 'es-mateo', label: 'Mateo' },
      { id: 'device', label: 'Voz del dispositivo' },
    ]);
    expect(read.voiceChoice.value).toBe('es-lucia');
    read.chooseVoice(new CustomEvent('ionChange', { detail: { value: 'es-mateo' } }));
    read.chooseVoice(new CustomEvent('ionChange', { detail: { value: 'en-emma' } }));
    expect(read.voiceChoice.value).toBe('es-mateo');
    expect(localStorage.getItem('erplora.assistant.voice.es')).toBe('es-mateo');
  });

  it('server voices without the host’s `speak`: nothing to choose, and the device reads', async () => {
    const { read } = await reading({ voices: CATALOGUE });
    expect([read.canSpeak.value, read.voiceOptions.value]).toEqual([true, []]);
  });

  it('a browser that reads: the «Device voice» kept for the language is the one chosen at once', async () => {
    vi.stubGlobal('speechSynthesis', { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] });
    vi.stubGlobal('SpeechSynthesisUtterance', class {});
    localStorage.setItem('erplora.assistant.voice.es', 'device');
    const { read } = await reading({ voices: CATALOGUE, speak: vi.fn() });
    expect(read.voiceChoice.value).toBe('device');
  });

  it('the screen changes language while it reads: the reading stops, and the new language’s voices are offered', async () => {
    const m = await reading({ voices: CATALOGUE, speak: vi.fn() });
    m.read.chooseVoice(new CustomEvent('ionChange', { detail: { value: 'device' } }));
    m.read.listen(ANSWER);
    await flush();
    (m.wrapper.vm as unknown as { $i18n: { locale: string } }).$i18n.locale = 'en';
    await flush();
    expect(invoke.mock.calls.map(([command]) => command)).toContain(TTS_STOP_COMMAND);
    expect(m.read.speaking.value).toBeNull();
    expect(m.read.voiceOptions.value.map((option) => option.id)).toEqual(['en-emma', 'device']);
    expect(m.read.voiceChoice.value).toBe('en-emma');
  });

  it('unmounted while it reads (the person signs out): the reading stops', async () => {
    const m = await reading();
    m.read.listen(ANSWER);
    await flush();
    m.wrapper.unmount();
    expect(invoke.mock.calls.map(([command]) => command)).toContain(TTS_STOP_COMMAND);
  });
});
