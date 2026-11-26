import { afterEach, beforeEach, describe, expect, it, type Mock, type MockInstance, vi } from 'vitest';

import { answer, assistant, panel, script, setUpPanel, tearDownPanel } from './__tests__/assistant-panel';
import { flush, memoryStorage } from './__tests__/mount-assistant';
import { type AssistantConfig, type AssistantSpeech } from './config';
import { TTS_AVAILABLE_COMMAND, TTS_SPEAK_COMMAND, TTS_STOP_COMMAND } from './nativeVoice';

vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('../FormModal/__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

beforeEach(setUpPanel);
afterEach(tearDownPanel);

describe('AssistantPanel', () => {
  describe('«Read aloud» under an answer: the device’s voice, unless the host turns it off (ui#66)', () => {
    /** A device that can read aloud: its voice (with a Spanish voice of Spain's and one of Mexico's) and what it reads. */
    function deviceVoice() {
      const voice = {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: () => [
          { name: 'Paulina', lang: 'es-MX' },
          { name: 'Google español', lang: 'es-ES' },
        ],
      };
      vi.stubGlobal('speechSynthesis', voice);
      vi.stubGlobal(
        'SpeechSynthesisUtterance',
        class {
          lang = '';
          voice: unknown = null;
          onend: (() => void) | null = null;
          onerror: (() => void) | null = null;
          constructor(public text: string) {}
        },
      );
      return voice;
    }

    /** A host's catalogue of server voices (`AssistantConfig.voices`): made up, the package names none of its own. */
    const LUCIA = 'es-lucia';
    const MATEO = 'es-mateo';
    const CATALOGUE = [
      { id: LUCIA, name: 'Lucía', language: 'es' as const },
      { id: MATEO, name: 'Mateo', language: 'es' as const },
      { id: 'en-emma', name: 'Emma', language: 'en' as const },
      { id: 'en-noah', name: 'Noah', language: 'en' as const },
    ];

    async function answered(config?: Partial<AssistantConfig>) {
      script.push(answer('Hoy has vendido 120 €.'));
      const m = await panel({ config });
      await assistant.ask('¿Cuánto he vendido?');
      await flush();
      expect(m.wrapper.get('[data-testid="assistant-answer"]').text()).toContain('Hoy has vendido 120 €.');
      return m;
    }

    it('a host that says nothing of it: offered when the device can read, and it reads the answer in its best voice', async () => {
      const voice = deviceVoice();
      const m = await answered();
      await m.wrapper.get('[data-testid="assistant-listen"]').trigger('click');
      await flush();
      expect(voice.speak).toHaveBeenCalledTimes(1);
      expect(voice.speak.mock.calls[0][0]).toMatchObject({
        text: 'Hoy has vendido 120 €.',
        lang: 'es-ES',
        voice: { name: 'Google español' },
      });
    });

    it('a host that turns it off (`readAloud: false`): no «Read aloud», and the device’s voice is never touched', async () => {
      const voice = deviceVoice();
      const m = await answered({ readAloud: false });
      expect(m.wrapper.find('[data-testid="assistant-listen"]').exists()).toBe(false);
      m.wrapper.unmount();
      expect(voice.speak).not.toHaveBeenCalled();
      expect(voice.cancel).not.toHaveBeenCalled();
    });

    it.each(['speechSynthesis', 'SpeechSynthesisUtterance'])(
      'a device that cannot read (no %s): no «Read aloud», even when the host asks for it',
      async (missing) => {
        deviceVoice();
        vi.stubGlobal(missing, undefined);
        const m = await answered({ readAloud: true });
        expect(m.wrapper.find('[data-testid="assistant-listen"]').exists()).toBe(false);
      },
    );

    describe('in the installed app, in the system’s voice', () => {
      type TauriWindow = { __TAURI__?: unknown };
      /** What the app has a voice for, and its readings, left to end by hand. */
      let voices: Record<string, boolean>;
      let readings: { resolve: (value: unknown) => void; reject: (error: unknown) => void }[];
      let invoke: Mock<(command: string, args?: Record<string, unknown>) => Promise<unknown>>;
      let warn: MockInstance<typeof console.warn>;

      beforeEach(() => {
        voices = { 'es-ES': true, 'en-US': true };
        readings = [];
        invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => {
          if (command === TTS_AVAILABLE_COMMAND) return { available: voices[String(args?.language)] === true };
          if (command === TTS_SPEAK_COMMAND) return new Promise((resolve, reject) => readings.push({ resolve, reject }));
          if (command === TTS_STOP_COMMAND) readings.splice(0).forEach((reading) => reading.resolve(null));
          return null;
        });
        (window as TauriWindow).__TAURI__ = { core: { invoke } };
        // The Android webview: no `speechSynthesis`.
        vi.stubGlobal('speechSynthesis', undefined);
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      });

      afterEach(() => {
        delete (window as TauriWindow).__TAURI__;
        warn.mockRestore();
      });

      const listenButton = (m: Awaited<ReturnType<typeof answered>>) => m.wrapper.get('[data-testid="assistant-listen"]');
      const commands = () => invoke.mock.calls.map(([command]) => command);

      it('the Android app, whose webview cannot read: «Read aloud» reads the answer in the system’s voice', async () => {
        const m = await answered();
        await listenButton(m).trigger('click');
        await flush();
        expect(invoke).toHaveBeenCalledWith(TTS_SPEAK_COMMAND, { text: 'Hoy has vendido 120 €.', language: 'es-ES' });
        expect(listenButton(m).attributes('aria-pressed')).toBe('true');
        readings[0].resolve(null);
        await flush();
        expect(listenButton(m).attributes('aria-pressed')).toBe('false');
      });

      it('pressed again while it reads: the system’s voice stops', async () => {
        const m = await answered();
        await listenButton(m).trigger('click');
        await flush();
        await listenButton(m).trigger('click');
        await flush();
        expect(commands()).toContain(TTS_STOP_COMMAND);
        expect(listenButton(m).attributes('aria-pressed')).toBe('false');
      });

      it('the system’s voice fails: said under the answer, never silent', async () => {
        const m = await answered();
        await listenButton(m).trigger('click');
        await flush();
        readings[0].reject('tts_failed');
        await flush();
        expect(m.wrapper.get('[data-testid="assistant-listen-failed"]').text()).toBe(
          'No se ha podido leer la respuesta en voz alta. Inténtalo de nuevo.',
        );
      });

      it('an app with no voice for the language: no «Read aloud»', async () => {
        voices = {};
        const m = await answered();
        expect(m.wrapper.find('[data-testid="assistant-listen"]').exists()).toBe(false);
      });

      it('the app is asked nothing while the panel is closed: its voice is not woken for a panel nobody opened', async () => {
        await panel({ open: false });
        await flush();
        expect(invoke).not.toHaveBeenCalled();
        assistant.setOpen(true);
        for (let i = 0; i < 3; i += 1) await flush();
        expect(invoke).toHaveBeenCalledWith(TTS_AVAILABLE_COMMAND, { language: 'es-ES' });
      });

      it('the Windows app (its webview reads with Windows’ voices): the browser’s voice reads, the app having none', async () => {
        voices = {};
        const voice = deviceVoice();
        const m = await answered();
        await listenButton(m).trigger('click');
        await flush();
        expect(voice.speak).toHaveBeenCalledTimes(1);
        expect(commands()).not.toContain(TTS_SPEAK_COMMAND);
      });

      it('with a server voice, the «Device voice» kept is the one chosen once the app says it has a voice for the language', async () => {
        const stored = memoryStorage();
        vi.stubGlobal('localStorage', stored);
        stored.setItem('erplora.assistant.voice.es', 'device');
        const m = await answered({ voices: CATALOGUE, speak: vi.fn(async () => new Blob(['mp3'], { type: 'audio/mpeg' })) });
        const select = m.wrapper.get('[data-testid="assistant-voice"]').element as unknown as { value: string };
        expect(select.value).toBe('device');
      });

      it('with a server voice, «Device voice» is the system’s, offered when the app has a voice for the language', async () => {
        const MP3 = new Blob(['mp3'], { type: 'audio/mpeg' });
        const m = await answered({ voices: CATALOGUE, speak: vi.fn(async () => MP3) });
        const options = m.wrapper.get('[data-testid="assistant-voice"]').findAll('ion-select-option');
        expect(options.map((option) => option.text())).toEqual(['Lucía', 'Mateo', 'Voz del dispositivo']);
        m.wrapper.unmount();
        voices = {};
        const without = await answered({ voices: CATALOGUE, speak: vi.fn(async () => MP3) });
        const left = without.wrapper.get('[data-testid="assistant-voice"]').findAll('ion-select-option');
        expect(left.map((option) => option.text())).toEqual(['Lucía', 'Mateo']);
      });
    });

    describe('in a server voice, when the host has one (`speak`)', () => {
      const MP3 = new Blob(['mp3'], { type: 'audio/mpeg' });

      /** The page's audio player: each one made, as the panel plays it. */
      class FakeAudio {
        static made: FakeAudio[] = [];
        src = '';
        currentTime = 0;
        onended: (() => void) | null = null;
        onerror: (() => void) | null = null;
        load = vi.fn();
        play = vi.fn(async () => {});
        pause = vi.fn();
        removeAttribute = vi.fn((name: string) => {
          if (name === 'src') this.src = '';
        });
        constructor() {
          FakeAudio.made.push(this);
        }
      }

      let created: MockInstance<typeof URL.createObjectURL>;
      let revoked: MockInstance<typeof URL.revokeObjectURL>;
      let warn: MockInstance<typeof console.warn>;
      /** The device's storage, where the choice of voice is kept. */
      let stored: Storage;

      beforeEach(() => {
        FakeAudio.made = [];
        vi.stubGlobal('Audio', FakeAudio);
        // The server's audio, and the silent clip that unlocks the player in the click.
        created = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => (blob === MP3 ? 'blob:answer' : 'blob:silence'));
        revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        stored = memoryStorage();
        vi.stubGlobal('localStorage', stored);
      });

      afterEach(() => {
        created.mockRestore();
        revoked.mockRestore();
        warn.mockRestore();
      });

      const listenButton = (m: Awaited<ReturnType<typeof answered>>) => m.wrapper.get('[data-testid="assistant-listen"]');
      const voiceSelect = (m: Awaited<ReturnType<typeof answered>>) => m.wrapper.find('[data-testid="assistant-voice"]');

      /** What an Ionic element was given (Vue sets its props as the element's properties, not as attributes). */
      const prop = (element: Element, name: 'interface' | 'value') => (element as unknown as Record<string, unknown>)[name];

      async function choose(m: Awaited<ReturnType<typeof answered>>, value: string) {
        voiceSelect(m).element.dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
        await flush();
      }

      it('reads the answer in the language’s first voice and plays its audio, «Stop reading» while it sounds', async () => {
        deviceVoice();
        const speak = vi.fn(async () => MP3);
        const m = await answered({ voices: CATALOGUE, speak });
        await listenButton(m).trigger('click');
        await flush();
        expect(speak).toHaveBeenCalledWith({
          text: 'Hoy has vendido 120 €.',
          language: 'es',
          voice: LUCIA,
          signal: expect.any(AbortSignal),
        });
        expect(created).toHaveBeenCalledWith(MP3);
        expect(FakeAudio.made).toHaveLength(1);
        expect(FakeAudio.made[0].src).toBe('blob:answer');
        expect(FakeAudio.made[0].play).toHaveBeenCalled();
        expect(listenButton(m).attributes('aria-pressed')).toBe('true');
        expect(listenButton(m).attributes('aria-label')).toBe('Dejar de leer');
        FakeAudio.made[0].onended?.();
        await flush();
        expect(revoked).toHaveBeenCalledWith('blob:answer');
        expect(listenButton(m).attributes('aria-pressed')).toBe('false');
        expect(listenButton(m).attributes('aria-label')).toBe('Leer en voz alta');
      });

      it('«Stop reading» stops the audio and frees it', async () => {
        const speak = vi.fn(async () => MP3);
        const m = await answered({ speak });
        await listenButton(m).trigger('click');
        await flush();
        await listenButton(m).trigger('click');
        await flush();
        expect(FakeAudio.made[0].pause).toHaveBeenCalled();
        expect(revoked).toHaveBeenCalledWith('blob:answer');
        expect(listenButton(m).attributes('aria-pressed')).toBe('false');
      });

      it('the server fails (not configured, down): the device reads it in its own voice', async () => {
        const voice = deviceVoice();
        const speak = vi.fn(async () => {
          throw new Error('assistant.speech.not_configured');
        });
        const m = await answered({ voices: CATALOGUE, speak });
        await listenButton(m).trigger('click');
        await flush();
        expect(speak).toHaveBeenCalled();
        expect(voice.speak).toHaveBeenCalledTimes(1);
        expect(voice.speak.mock.calls[0][0]).toMatchObject({ text: 'Hoy has vendido 120 €.', lang: 'es-ES' });
        expect(m.wrapper.find('[data-testid="assistant-listen-failed"]').exists()).toBe(false);
      });

      it('the server fails on a device that cannot read (the Android webview): said under the answer, never silent', async () => {
        vi.stubGlobal('speechSynthesis', undefined);
        const speak = vi.fn<(input: AssistantSpeech) => Promise<Blob>>(async () => {
          throw new Error('down');
        });
        const m = await answered({ voices: CATALOGUE, speak });
        expect(voiceSelect(m).exists()).toBe(true);
        await listenButton(m).trigger('click');
        await flush();
        expect(m.wrapper.get('[data-testid="assistant-listen-failed"]').text()).toBe(
          'No se ha podido leer la respuesta en voz alta. Inténtalo de nuevo.',
        );
        expect(listenButton(m).attributes('aria-pressed')).toBe('false');
        speak.mockImplementation(async () => MP3);
        await listenButton(m).trigger('click');
        await flush();
        expect(m.wrapper.find('[data-testid="assistant-listen-failed"]').exists()).toBe(false);
      });

      it('the voice is chosen in the panel: the language’s two and the device’s, remembered by the device', async () => {
        const voice = deviceVoice();
        const speak = vi.fn(async () => MP3);
        const m = await answered({ voices: CATALOGUE, speak });
        const select = voiceSelect(m);
        expect(prop(select.element, 'interface')).toBe('popover');
        expect(prop(select.element, 'value')).toBe(LUCIA);
        expect(select.findAll('ion-select-option').map((option) => [prop(option.element, 'value'), option.text()])).toEqual([
          [LUCIA, 'Lucía'],
          [MATEO, 'Mateo'],
          ['device', 'Voz del dispositivo'],
        ]);

        await choose(m, MATEO);
        expect(stored.getItem('erplora.assistant.voice.es')).toBe(MATEO);
        await listenButton(m).trigger('click');
        await flush();
        expect(speak).toHaveBeenLastCalledWith({
          text: 'Hoy has vendido 120 €.',
          language: 'es',
          voice: MATEO,
          signal: expect.any(AbortSignal),
        });
        FakeAudio.made[0].onended?.();
        await flush();

        await choose(m, 'device');
        expect(stored.getItem('erplora.assistant.voice.es')).toBe('device');
        await listenButton(m).trigger('click');
        await flush();
        expect(speak).toHaveBeenCalledTimes(1);
        expect(voice.speak).toHaveBeenCalledTimes(1);
      });

      it('the voice the device remembers is the one read in', async () => {
        stored.setItem('erplora.assistant.voice.es', MATEO);
        const speak = vi.fn(async () => MP3);
        const m = await answered({ voices: CATALOGUE, speak });
        expect(prop(voiceSelect(m).element, 'value')).toBe(MATEO);
        await listenButton(m).trigger('click');
        await flush();
        expect(speak).toHaveBeenCalledWith(expect.objectContaining({ voice: MATEO }));
      });

      it('the screen changes language: the voices of the new one, and the choice kept for it', async () => {
        deviceVoice();
        stored.setItem('erplora.assistant.voice.es', MATEO);
        stored.setItem('erplora.assistant.voice.en', 'en-noah');
        const speak = vi.fn(async () => MP3);
        const m = await answered({ voices: CATALOGUE, speak });
        expect(prop(voiceSelect(m).element, 'value')).toBe(MATEO);
        (m.wrapper.vm as unknown as { $i18n: { locale: string } }).$i18n.locale = 'en';
        await flush();
        expect(voiceSelect(m).findAll('ion-select-option').map((option) => option.text())).toEqual(['Emma', 'Noah', 'Device voice']);
        expect(prop(voiceSelect(m).element, 'value')).toBe('en-noah');
        await listenButton(m).trigger('click');
        await flush();
        expect(speak).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', voice: 'en-noah' }));
      });

      it('the screen changes language while it reads: the reading stops, «Read aloud» again', async () => {
        const speak = vi.fn(async () => MP3);
        const m = await answered({ speak });
        await listenButton(m).trigger('click');
        await flush();
        expect(listenButton(m).attributes('aria-pressed')).toBe('true');
        (m.wrapper.vm as unknown as { $i18n: { locale: string } }).$i18n.locale = 'en';
        await flush();
        expect(FakeAudio.made[0].pause).toHaveBeenCalled();
        expect(revoked).toHaveBeenCalledWith('blob:answer');
        expect(listenButton(m).attributes('aria-pressed')).toBe('false');
        expect(listenButton(m).attributes('aria-label')).toBe('Read aloud');
      });

      it('the panel goes away while it reads (the person signs out): the reading stops', async () => {
        const speak = vi.fn(async () => MP3);
        const m = await answered({ speak });
        await listenButton(m).trigger('click');
        await flush();
        m.wrapper.unmount();
        expect(FakeAudio.made[0].pause).toHaveBeenCalled();
        expect(revoked).toHaveBeenCalledWith('blob:answer');
      });

      it('on a device that cannot read, no «Device voice» to choose', async () => {
        vi.stubGlobal('speechSynthesis', undefined);
        const m = await answered({ voices: CATALOGUE, speak: vi.fn(async () => MP3) });
        expect(voiceSelect(m).findAll('ion-select-option').map((option) => option.text())).toEqual(['Lucía', 'Mateo']);
      });

      it('`speak` and no catalogue: nothing to choose, the server picks its voice, and the device reads when it refuses', async () => {
        const voice = deviceVoice();
        const speak = vi.fn(async () => {
          throw new Error('assistant.speech_unavailable');
        });
        const m = await answered({ speak });
        expect(voiceSelect(m).exists()).toBe(false);
        await listenButton(m).trigger('click');
        await flush();
        expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Hoy has vendido 120 €.', language: 'es', voice: '' }));
        expect(voice.speak).toHaveBeenCalledTimes(1);
      });

      it('`speak` and no catalogue: a choice kept on the device, which nobody could undo here, is not followed', async () => {
        deviceVoice();
        stored.setItem('erplora.assistant.voice.es', 'device');
        const speak = vi.fn(async () => MP3);
        const m = await answered({ speak });
        await listenButton(m).trigger('click');
        await flush();
        expect(speak).toHaveBeenCalledWith(expect.objectContaining({ voice: '' }));
      });

      it('no choice of voice without a server voice, nor with «Read aloud» off', async () => {
        deviceVoice();
        const without = await answered();
        expect(voiceSelect(without).exists()).toBe(false);
        without.wrapper.unmount();
        const off = await answered({ voices: CATALOGUE, speak: vi.fn(async () => MP3), readAloud: false });
        expect(voiceSelect(off).exists()).toBe(false);
        expect(off.wrapper.find('[data-testid="assistant-listen"]').exists()).toBe(false);
      });
    });
  });
});
