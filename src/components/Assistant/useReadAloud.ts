import { computed, onBeforeUnmount, type Ref, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { nativeBridge } from '../../shell/native-bridge';
import { type AssistantConfig, assistantConfig } from './config';
import { createDeviceReader, deviceEnv } from './deviceVoice';
import type { Bubble } from './history';
import { parseMarkdown, spokenText } from './markdown';
import { createDeviceVoice, type DeviceVoice } from './nativeVoice';
import { browserAudio, createReadAloud, type ReadAloud } from './readAloud';
import { browserStorage } from './state';
import { type AssistantLanguage, DEVICE_VOICE, languageOf, readVoiceChoice, saveVoiceChoice, voicesFor } from './voices';

/** The device's voice and the reader of the answers: none of them when the host turns «Read aloud» off. */
function readers(config: AssistantConfig) {
  const readAloud = config.readAloud !== false;
  const browserVoice = readAloud ? deviceEnv() : null;
  const deviceReader = readAloud
    ? createDeviceVoice({
        invoke: nativeBridge()?.invoke ?? null,
        browser: browserVoice ? createDeviceReader(browserVoice) : null,
      })
    : null;
  const reader = readAloud && (config.speak || deviceReader)
    ? createReadAloud({ speak: config.speak, device: deviceReader, audio: browserAudio() })
    : null;
  return { deviceReader, reader };
}

interface VoicesSource {
  open: () => boolean;
  language: Ref<AssistantLanguage>;
  deviceReader: DeviceVoice | null;
  reader: ReadAloud | null;
}

/** The voices that read the screen's language, and the one the person chose for it, kept on the device. */
function useVoices(config: AssistantConfig, source: VoicesSource) {
  const { t } = useI18n({ useScope: 'global' });
  const { language, deviceReader, reader } = source;
  /** Whether the device reads the language aloud: at once with the browser's voice; with only the app's, once it says
   *  so for the language. */
  const deviceReads = ref(deviceReader?.browser ?? false);

  const voiceStorage = browserStorage('localStorage');
  const voiceChoice = ref(DEVICE_VOICE);
  const serverVoices = config.voices ?? [];
  watch(
    language,
    (current) => {
      voiceChoice.value = readVoiceChoice(voiceStorage, current, { device: deviceReads.value, voices: serverVoices });
    },
    { immediate: true },
  );

  // With only the app's voice, the app is asked once the panel opens whether it reads the language; when it does, the
  // choice kept for the language is read again.
  watch(
    [source.open, language],
    ([open, current]) => {
      if (!open || !deviceReader || deviceReader.browser) return;
      void deviceReader.canRead(current).then((reads) => {
        if (language.value === current) deviceReads.value = reads;
      });
    },
    { immediate: true },
  );
  watch(deviceReads, (reads) => {
    voiceChoice.value = readVoiceChoice(voiceStorage, language.value, { device: reads, voices: serverVoices });
  });

  /** What the person may choose: the language's server voices and the device's, where it can read; nothing to choose
   *  without server voices for the language (the host's `speak`, if any, reads in the server's own). */
  const voiceOptions = computed(() => {
    const voices = voicesFor(serverVoices, language.value);
    return reader && config.speak && voices.length
      ? [
          ...voices.map((voice) => ({ id: voice.id, label: voice.name })),
          ...(deviceReads.value ? [{ id: DEVICE_VOICE, label: t('assistant.speech.device') }] : []),
        ]
      : [];
  });

  function chooseVoice(event: CustomEvent<{ value?: unknown }>): void {
    const choice = String(event.detail.value ?? '');
    if (!voiceOptions.value.some((option) => option.id === choice)) return;
    voiceChoice.value = choice;
    saveVoiceChoice(voiceStorage, language.value, choice);
  }

  return { deviceReads, voiceChoice, voiceOptions, chooseVoice };
}

/** «Read aloud» under the assistant's answers: one answer read at a time, stopped when the screen changes language or
 *  the panel goes away. `open` says whether the panel is open; `nameOf` names a screen a link of the answer goes to. */
export function useReadAloud({ open, nameOf }: { open: () => boolean; nameOf: (path: string) => string | undefined }) {
  const config = assistantConfig();
  const { locale } = useI18n({ useScope: 'global' });
  const { deviceReader, reader } = readers(config);
  const speaking = ref<string | null>(null);
  /** The answer whose «Read aloud» failed: said under it until the next. */
  const failedRead = ref<string | null>(null);

  const language = computed(() => languageOf(locale.value));
  watch(language, () => {
    // A new language: what was being read in the old one stops.
    if (speaking.value) {
      reader?.stop();
      speaking.value = null;
    }
  });
  const { deviceReads, voiceChoice, voiceOptions, chooseVoice } = useVoices(config, { open, language, deviceReader, reader });
  /** «Read aloud» under the answers: a server voice, or the device's for the language. */
  const canSpeak = computed(() => reader !== null && (Boolean(config.speak) || deviceReads.value));

  function listen(bubble: Bubble): void {
    if (!reader) return;
    failedRead.value = null;
    if (speaking.value === bubble.id) {
      reader.stop();
      speaking.value = null;
      return;
    }
    speaking.value = bubble.id;
    reader.read(spokenText(parseMarkdown(bubble.text), nameOf), language.value, voiceChoice.value).then(
      () => {
        if (speaking.value === bubble.id) speaking.value = null;
      },
      (error: unknown) => {
        console.warn('assistant: the answer could not be read aloud', error);
        if (speaking.value !== bubble.id) return;
        speaking.value = null;
        failedRead.value = bubble.id;
      },
    );
  }

  onBeforeUnmount(() => {
    if (speaking.value) reader?.stop();
  });

  return { canSpeak, speaking, failedRead, listen, voiceChoice, voiceOptions, chooseVoice };
}
