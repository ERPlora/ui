// One dictation for every screen that dictates to the assistant: the composer's «Dictate by voice» and an app's key
// that opens the assistant by dictating. While the browser asks for the microphone another tap opens no second
// recording. The words land in the assistant's box after what was written and are never sent by themselves: the person
// reads what was understood and sends it. Leaving the screen throws away a recording the browser was still starting too
// (its microphone is freed as soon as it arrives); a transcription already on its way still lands, without opening the
// panel.
import { computed, type MaybeRefOrGetter, onBeforeUnmount, ref, shallowRef, toValue } from 'vue';
import { useI18n } from 'vue-i18n';

import { useLiveClient } from '../../sdk/live-client';
import { nativeBridge } from '../../shell/device-notices';
import { assistantConfig } from './config';
import { base64Of, browserVoice, canDictate, type Recording, recordVoice, type VoiceEnv } from './input';
import { useAssistant } from './state';

/** A dictation is transcribed up to 2 MB of audio. */
export const MAX_AUDIO_BYTES = 2 * 1024 * 1024;

/** Why a dictation did not land; the chat's catalogue says each as `assistant.voice.<problem>`. */
export type DictationProblem = 'denied' | 'deniedInApp' | 'tooLong' | 'empty' | 'failed';

export interface DictationOptions {
  /** The microphone and the recorder; the browser's when not given. */
  voice?: MaybeRefOrGetter<VoiceEnv>;
  onProblem?: (problem: DictationProblem) => void;
}

/** Called from `setup()`: the dictation of that screen, thrown away when it unmounts. */
export function useDictation(options: DictationOptions = {}) {
  const { locale } = useI18n({ useScope: 'global' });
  const client = useLiveClient();
  const assistant = useAssistant();
  const { transcribe: transcribeClip } = assistantConfig();
  const fallback = options.voice === undefined ? browserVoice() : undefined;
  const voice = (): VoiceEnv => fallback ?? toValue(options.voice) ?? {};

  const current = shallowRef<Recording | null>(null);
  const transcribing = ref(false);
  /** The browser is still asking for the microphone. */
  const starting = ref(false);
  /** Bumped by `cancel`: a recording that arrives after it is thrown away; a transcription, not opening the panel. */
  let generation = 0;

  const available = computed(() => transcribeClip !== undefined && canDictate(voice()));
  const recording = computed(() => current.value !== null);

  function say(problem: DictationProblem): void {
    options.onProblem?.(problem);
  }

  async function transcribe(clip: Recording): Promise<void> {
    const mine = generation;
    transcribing.value = true;
    try {
      const { blob, mime } = await clip.stop();
      if (blob.size > MAX_AUDIO_BYTES) return say('tooLong');
      if (!transcribeClip) return say('failed');
      const answer = await transcribeClip(client, { audio: await base64Of(blob), mime_type: mime, language: locale.value });
      const words = answer.text.trim();
      if (!words) return say('empty');
      const before = assistant.state.draft.trimEnd();
      assistant.state.draft = before ? `${before} ${words}` : words;
      // Left meanwhile (the panel closed while «Transcribing…»): the words wait in the box, the panel stays as it is.
      if (mine === generation) assistant.setOpen(true);
    } catch (error) {
      console.error('assistant: dictation failed', error);
      say('failed');
    } finally {
      transcribing.value = false;
    }
  }

  async function start(): Promise<void> {
    const mine = generation;
    starting.value = true;
    try {
      // Two minutes: it stops by itself and what was said is transcribed.
      const started = await recordVoice(voice(), () => {
        if (current.value === started) {
          current.value = null;
          void transcribe(started);
        }
      });
      if (mine !== generation) return started.cancel();
      current.value = started;
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      if (!denied) console.error('assistant: the microphone did not start', error);
      // The installed app has no browser bar: there the microphone is allowed again in the device's settings.
      say(denied ? (nativeBridge() ? 'deniedInApp' : 'denied') : 'failed');
    } finally {
      starting.value = false;
    }
  }

  /** A tap: records, or stops and transcribes what was recorded. */
  async function toggle(): Promise<void> {
    if (transcribing.value || starting.value) return;
    const clip = current.value;
    if (!clip) return start();
    current.value = null;
    return transcribe(clip);
  }

  function cancel(): void {
    generation += 1;
    current.value?.cancel();
    current.value = null;
  }

  onBeforeUnmount(cancel);

  return { available, recording, transcribing, starting, toggle, cancel };
}

export type Dictation = ReturnType<typeof useDictation>;
