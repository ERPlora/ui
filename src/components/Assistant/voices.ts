// The voices the assistant reads its answers in (round 2026-11-03m): the server's (Azure AI Speech, the DragonHD
// voices, served by the Hub and the SaaS as mp3 through `AssistantConfig.speak`), two per language, and the device's
// own as the other choice and the fallback. One voice chosen, as ChatGPT, Gemini, Alexa or Siri do: never a different
// one per answer. The SaaS keeps the same catalogue in Python: the ids are the contract with the server.
// The person's choice is remembered by the device, one per language (`erplora.assistant.voice.<language>`).

export type AssistantLanguage = 'es' | 'en';

export interface AssistantVoice {
  /** The server's name of the voice (the contract with the SaaS's catalogue). */
  id: string;
  /** The name shown to the person. */
  name: string;
  language: AssistantLanguage;
  gender: 'female' | 'male';
}

export const ASSISTANT_VOICES: readonly AssistantVoice[] = Object.freeze([
  { id: 'es-ES-Ximena:DragonHDLatestNeural', name: 'Ximena', language: 'es', gender: 'female' },
  { id: 'es-ES-Tristan:DragonHDLatestNeural', name: 'Tristan', language: 'es', gender: 'male' },
  { id: 'en-US-Ava:DragonHDLatestNeural', name: 'Ava', language: 'en', gender: 'female' },
  { id: 'en-US-Andrew2:DragonHDLatestNeural', name: 'Andrew', language: 'en', gender: 'male' },
]);

/** The choice of the browser's or the device's own voice (`speechSynthesis`). */
export const DEVICE_VOICE = 'device';

/** The language of the voices for the screen's (`es`, `es-ES`): English where there is no voice of its own. */
export function languageOf(locale: string): AssistantLanguage {
  return locale.toLowerCase().split(/[-_]/)[0] === 'es' ? 'es' : 'en';
}

export function voicesFor(language: AssistantLanguage): AssistantVoice[] {
  return ASSISTANT_VOICES.filter((voice) => voice.language === language);
}

/** The first voice of the language: what is read in until the person chooses. */
export function defaultVoice(language: AssistantLanguage): AssistantVoice {
  const [first] = voicesFor(language);
  if (!first) throw new Error(`assistant: no voice for the language ${language}`);
  return first;
}

/** Where the device keeps the choice of a language. */
export function voiceKey(language: AssistantLanguage): string {
  return `erplora.assistant.voice.${language}`;
}

/** The voice chosen for the language (a catalogue id, or `DEVICE_VOICE` where the device can read), else its default. */
export function readVoiceChoice(
  storage: Storage | undefined,
  language: AssistantLanguage,
  { device }: { device: boolean },
): string {
  let kept: string | null = null;
  try {
    kept = storage?.getItem(voiceKey(language)) ?? null;
  } catch {
    // A storage that refuses to be read (private mode, blocked) keeps nothing: the default is read in.
    kept = null;
  }
  if (kept === DEVICE_VOICE && device) return DEVICE_VOICE;
  if (kept && voicesFor(language).some((voice) => voice.id === kept)) return kept;
  return defaultVoice(language).id;
}

/** Keeps the choice of the language on this device; one it cannot keep is said, and lasts until the page closes. */
export function saveVoiceChoice(storage: Storage | undefined, language: AssistantLanguage, choice: string): void {
  try {
    storage?.setItem(voiceKey(language), choice);
  } catch (error) {
    console.warn('assistant: the choice of voice could not be kept on this device', error);
  }
}
