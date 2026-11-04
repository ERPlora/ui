// The voices the assistant reads its answers in: the server's, when the host has them (`AssistantConfig.voices`, with
// `speak`: their ids are the contract between the host and its server, so the package names none; none today, no engine
// reads aloud, PLAN-SAAS round 2026-11-04c), and the device's own as the other choice and the fallback. One voice chosen,
// as ChatGPT, Gemini, Alexa or Siri do: never a different one per answer.
// The person's choice is remembered by the device, one per language (`erplora.assistant.voice.<language>`).

export type AssistantLanguage = 'es' | 'en';

export interface AssistantVoice {
  /** The server's name of the voice (the contract with the host's server). */
  id: string;
  /** The name shown to the person. */
  name: string;
  language: AssistantLanguage;
}

/** The choice of the browser's or the device's own voice (`speechSynthesis`). */
export const DEVICE_VOICE = 'device';

/** The language of the voices for the screen's (`es`, `es-ES`): English where there is no voice of its own. */
export function languageOf(locale: string): AssistantLanguage {
  return locale.toLowerCase().split(/[-_]/)[0] === 'es' ? 'es' : 'en';
}

export function voicesFor(voices: readonly AssistantVoice[], language: AssistantLanguage): AssistantVoice[] {
  return voices.filter((voice) => voice.language === language);
}

/** Where the device keeps the choice of a language. */
export function voiceKey(language: AssistantLanguage): string {
  return `erplora.assistant.voice.${language}`;
}

/** The voice to read the language in: the one chosen (a catalogue id, or `DEVICE_VOICE` where the device can read), else
 *  the language's first. Empty without voices for the language: nothing to choose, so whatever the device kept is not
 *  followed (nobody could change it here) and the server, asked with no voice, reads in its own. */
export function readVoiceChoice(
  storage: Storage | undefined,
  language: AssistantLanguage,
  { device, voices }: { device: boolean; voices: readonly AssistantVoice[] },
): string {
  const offered = voicesFor(voices, language);
  const [first] = offered;
  if (!first) return '';
  let kept: string | null = null;
  try {
    kept = storage?.getItem(voiceKey(language)) ?? null;
  } catch {
    // A storage that refuses to be read (private mode, blocked) keeps nothing: the first voice is read in.
    kept = null;
  }
  if (kept === DEVICE_VOICE && device) return DEVICE_VOICE;
  if (kept && offered.some((voice) => voice.id === kept)) return kept;
  return first.id;
}

/** Keeps the choice of the language on this device; one it cannot keep is said, and lasts until the page closes. */
export function saveVoiceChoice(storage: Storage | undefined, language: AssistantLanguage, choice: string): void {
  try {
    storage?.setItem(voiceKey(language), choice);
  } catch (error) {
    console.warn('assistant: the choice of voice could not be kept on this device', error);
  }
}
