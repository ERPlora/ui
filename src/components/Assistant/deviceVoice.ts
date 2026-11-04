// The device's own voice (`speechSynthesis`): the fallback of the server's voice and a choice of its own
// (`DEVICE_VOICE`). What makes it sound as well as the device can:
// - the language with its region (`es-ES`, `en-US`), never a bare `es`, which leaves the device to its first voice;
// - the best voice the device has for it, by its name: the online natural ones (Edge), the natural ones, Google's
//   (Chrome), the enhanced or premium ones (Apple), then the rest; for Spain's Spanish, never one of the United
//   States, Mexico or Latin America. Chosen once per language and kept;
// - the list waited for when the device gives it late (Chrome lists its voices after `voiceschanged`);
// - the text read in pieces of under 200 characters, by sentences, one after the other: desktop Chrome cuts its
//   online Google voices after about 15 seconds of a single utterance.
// The Android webview has no `speechSynthesis` (`deviceEnv` is none there): in the app, the system's voice reads
// instead (`nativeVoice.ts`, round 2026-11-04a).
import type { AssistantLanguage } from './voices';

/** The language each voice is read in, with its region. */
export const DEVICE_LANGS: Readonly<Record<AssistantLanguage, string>> = Object.freeze({ es: 'es-ES', en: 'en-US' });

/** The longest piece of text given to the device at once. */
export const MAX_PIECE = 200;

/** How long the device's list of voices is waited for before reading with the language alone. */
export const VOICES_WAIT_MS = 1500;

/** The Spanish of elsewhere, never read for Spain's. */
const SPANISH_ELSEWHERE = new Set(['es-us', 'es-mx', 'es-419']);

/** The names of the best voices first: online natural, natural, Google's, enhanced or premium; then the rest. */
const RANKS = [/online \(natural\)/i, /\(natural\)/i, /^google /i, /enhanced|premium/i];

interface VoiceLike {
  name: string;
  lang: string;
}

const normalLang = (lang: string) => lang.replace(/_/g, '-').toLowerCase();

function rank(name: string): number {
  const index = RANKS.findIndex((pattern) => pattern.test(name));
  return index === -1 ? RANKS.length : index;
}

/** The best voice the device has for the language; none when it has no voice of it. */
export function pickDeviceVoice<V extends VoiceLike>(voices: readonly V[], language: AssistantLanguage): V | null {
  const region = DEVICE_LANGS[language].toLowerCase();
  const candidates = voices.filter((voice) => {
    const lang = normalLang(voice.lang);
    if (lang !== language && !lang.startsWith(`${language}-`)) return false;
    return language !== 'es' || !SPANISH_ELSEWHERE.has(lang);
  });
  const order = (voice: V) => rank(voice.name) * 2 + (normalLang(voice.lang) === region ? 0 : 1);
  return [...candidates].sort((a, b) => order(a) - order(b))[0] ?? null;
}

/** Where a sentence ends: its marks and closing quotes, before a space or the end (never the point of `3.5`). */
const SENTENCE_END = /[.!?…:]+["'»”’)\]]*(?=\s|$)/g;

function sentencesOf(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const end of text.matchAll(SENTENCE_END)) {
    const stop = (end.index ?? 0) + end[0].length;
    sentences.push(text.slice(start, stop).trim());
    start = stop;
  }
  sentences.push(text.slice(start).trim());
  return sentences.filter(Boolean);
}

/** Where a sentence longer than `max` is cut: after a comma, else at a space, else where it reaches `max`. */
function cutAt(sentence: string, max: number): number {
  const head = sentence.slice(0, max + 1);
  const clause = Math.max(head.lastIndexOf(', '), head.lastIndexOf('; '), head.lastIndexOf(': '));
  if (clause > 0) return clause + 1;
  const space = head.lastIndexOf(' ');
  return space > 0 ? space : max;
}

function fit(sentence: string, max: number): string[] {
  const parts: string[] = [];
  let rest = sentence;
  while (rest.length > max) {
    const cut = cutAt(rest, max);
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

/** The text in pieces of at most `max` characters: whole sentences together, a longer one cut where it can be. */
export function speechPieces(text: string, max = MAX_PIECE): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const part of sentencesOf(text.replace(/\s+/g, ' ').trim()).flatMap((sentence) => fit(sentence, max))) {
    if (!piece) piece = part;
    else if (piece.length + 1 + part.length <= max) piece = `${piece} ${part}`;
    else {
      pieces.push(piece);
      piece = part;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

/** The device's voices; when its first list is empty, the one it gives on `voiceschanged`, or none after `waitMs`. */
export function deviceVoices(synth: SpeechSynthesis, waitMs = VOICES_WAIT_MS): Promise<SpeechSynthesisVoice[]> {
  const list = () => (typeof synth.getVoices === 'function' ? synth.getVoices() : []);
  const now = list();
  if (now.length > 0 || typeof synth.addEventListener !== 'function') return Promise.resolve(now);
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', finish);
      resolve(list());
    };
    const timer = setTimeout(finish, waitMs);
    synth.addEventListener('voiceschanged', finish);
  });
}

/** The device's voice and the utterances it reads. */
export interface DeviceEnv {
  synth: SpeechSynthesis;
  Utterance: typeof SpeechSynthesisUtterance;
}

/** The browser's voice, where it has one (never in the Android webview: `nativeVoice.ts`). */
export function deviceEnv(): DeviceEnv | null {
  const synth = globalThis.speechSynthesis as SpeechSynthesis | undefined;
  const Utterance = globalThis.SpeechSynthesisUtterance as typeof SpeechSynthesisUtterance | undefined;
  return typeof synth === 'object' && synth !== null && typeof Utterance === 'function' ? { synth, Utterance } : null;
}

/** A text being read: `done` when its last piece was read or it was cancelled; rejected when the device failed. */
export interface DeviceReading {
  done: Promise<void>;
  cancel(): void;
}

export interface DeviceReader {
  /** Reads the text in the language, cancelling what was being read. */
  read(text: string, language: AssistantLanguage): DeviceReading;
  /** Cancels what is being read, if anything. */
  cancel(): void;
}

export function createDeviceReader(env: DeviceEnv, { waitMs = VOICES_WAIT_MS }: { waitMs?: number } = {}): DeviceReader {
  const chosen = new Map<AssistantLanguage, SpeechSynthesisVoice>();
  let current: DeviceReading | null = null;
  // The utterance being read, held: Chrome may collect one nothing refers to, and its `end` never comes.
  const held = new Set<SpeechSynthesisUtterance>();

  async function voiceFor(language: AssistantLanguage): Promise<SpeechSynthesisVoice | null> {
    const kept = chosen.get(language);
    if (kept) return kept;
    const pick = pickDeviceVoice(await deviceVoices(env.synth, waitMs), language);
    if (pick) chosen.set(language, pick);
    return pick;
  }

  function read(text: string, language: AssistantLanguage): DeviceReading {
    current?.cancel();
    // A device left with something in its queue (or Chrome's stuck queue) starts clean.
    env.synth.cancel();
    const pieces = speechPieces(text);
    let stopped = false;
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const done = new Promise<void>((ok, fail) => {
      resolve = ok;
      reject = fail;
    });
    const say = (index: number, voice: SpeechSynthesisVoice | null): void => {
      if (stopped) return;
      if (index >= pieces.length) {
        stopped = true;
        held.clear();
        resolve();
        return;
      }
      const utterance = new env.Utterance(pieces[index]);
      utterance.lang = DEVICE_LANGS[language];
      if (voice) utterance.voice = voice;
      utterance.onend = () => say(index + 1, voice);
      utterance.onerror = (event) => {
        if (stopped) return;
        stopped = true;
        reject(new Error(`assistant: the device could not read aloud (${event.error})`));
      };
      held.clear();
      held.add(utterance);
      env.synth.speak(utterance);
    };
    const reading: DeviceReading = {
      done,
      cancel() {
        if (stopped) return;
        stopped = true;
        env.synth.cancel();
        resolve();
      },
    };
    current = reading;
    void voiceFor(language).then((voice) => say(0, voice));
    return reading;
  }

  return {
    read,
    cancel: () => current?.cancel(),
  };
}
