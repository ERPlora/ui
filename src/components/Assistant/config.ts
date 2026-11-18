// The host's configuration of the assistant's chat (each host gives the same chat its own tools), set once when the app
// boots, before anything mounts:
//   configureAssistant({ turnUrl: '/api/assistant/turn', usage: (client) => client.api.call('<app>.assistant.usage', {}) })
// Every optional field is a piece of the chat: without it, that piece is not there.
import type { LiveClient } from '../../sdk/live-client';
import type { ShellSession } from '../../shell/session';
import type { AssistantLanguage, AssistantVoice } from './voices';

/** The month's messages of the assistant: `limit` 0 is a plan without it; a demo counts none. */
export interface AssistantUsage {
  used: number;
  limit: number;
  resets_at: string | null;
  demo: boolean;
}

/** A dictation to turn into words: the recording in base64, its type and the language it was said in. */
export interface AssistantClip {
  audio: string;
  mime_type: string;
  language: string;
}

/** A text to read aloud in a server voice: the voice's id in the host's catalogue (`AssistantConfig.voices`; empty: the
 *  server's own for the language) and the language it is read in. */
export interface AssistantSpeech {
  text: string;
  language: AssistantLanguage;
  voice: string;
  /** Aborted when the person stops the reading (or asks for another) before the audio arrives: the host passes it to
   *  its `fetch`, so the server's work and the download stop too. */
  signal?: AbortSignal;
}

export interface AssistantReportInput {
  message_id: string;
  reason: 'incorrect' | 'harmful' | 'instructions' | 'other';
  comment?: string;
  question?: string;
  answer: string;
  /** Whether its turn brought pages of the web (`Bubble.web`); left out when the chat does not know, and then a host
   *  whose web search is on does not mail the answer. */
  web?: boolean;
}

/** A request of a turn that someone must approve before it runs (the Hub's manager approval). */
export interface AssistantApproval {
  /** Runs the request; when it needs an approval, asks for it and runs it again. */
  run<T>(request: () => Promise<T>): Promise<T>;
  /** Whether a failure is an approval nobody gave: the write is not done and the model hears a «Cancel». */
  declined(error: unknown): boolean;
}

export interface AssistantConfig {
  /** The route a turn is POSTed to (same origin). */
  turnUrl: string;
  /** The pass of a request being repeated after an approval, sent as `X-Elevation-Token`. */
  elevationToken?: () => string | undefined;
  approval?: AssistantApproval;
  /** Reads the month's allowance; rejects when it cannot be read (then the panel says nothing of it). */
  usage?: (client: LiveClient) => Promise<AssistantUsage>;
  /** Turns a dictation into words; without it, no microphone. */
  transcribe?: (client: LiveClient, clip: AssistantClip) => Promise<{ text: string }>;
  /** Sends the report of an answer; without it, no «Report a problem». */
  report?: (client: LiveClient, report: AssistantReportInput) => Promise<unknown>;
  /** Whether an answer offers «Read aloud» (the server's voice or the device's, where it has one); on when not given,
   *  `false` turns it off. */
  readAloud?: boolean;
  /** The audio (mp3) of a text read in a server voice; rejects when it cannot (not configured, down), and the device's
   *  voice reads it instead. Without it, the device's voice and no choice of voice. */
  speak?: (input: AssistantSpeech) => Promise<Blob>;
  /** The server voices the person may choose among, with `speak`, the first of each language by default: the ids are
   *  the contract between the host and its server. Without them, nothing to choose and `speak` is asked with no voice. */
  voices?: readonly AssistantVoice[];
  /** Who sees the assistant's button; everyone signed in when not given. */
  canUse?: (session: ShellSession) => boolean;
  /** Who may upgrade the plan (only ever offered on the web); nobody when not given. */
  canUpgrade?: (session: ShellSession) => boolean;
  planUrl?: () => string;
  /** Takes the click of «Upgrade plan», inside the click: the host may stop the link (`preventDefault`) and open it its
   *  own way (the Hub, with a pass that signs in). When it leaves the click alone, or without it, the link opens `planUrl`.
   *  A failure goes to the app's error handler; a host that already stopped the link still has to open something. */
  openPlan?: (client: LiveClient, event: Event) => void;
  /** The key of the verb of a write, by its operation (`<app>.<entity>.<action>`); «Do this» when not given. */
  verbKey?: (operation: string) => string;
  /** The key of the name of a platform screen a receipt names (the server's `screen`); none: the app's name. */
  placeKey?: (screen: string | undefined) => string | null;
  /** The key of the name of a platform screen by its path (`/settings`); none: the menu's name. */
  screenKey?: (path: string) => string | null;
  /** The key of the line said instead of «Upgrade plan» to whoever may not upgrade, under a spent allowance or a plan
   *  without the assistant; when not given, the line asks whoever runs the business to upgrade. */
  spentNoteKey?: string;
}

let current: AssistantConfig | undefined;

/** Sets the host's configuration (`undefined` forgets it: a test's own). */
export function configureAssistant(config: AssistantConfig | undefined): void {
  current = config;
}

export function assistantConfig(): AssistantConfig {
  if (!current) throw new Error('assistant: configureAssistant() was not called before the assistant was used');
  return current;
}

export function verbKeyOf(config: AssistantConfig, operation: string): string {
  return config.verbKey?.(operation) ?? 'assistant.card.other';
}

export function spentNoteKeyOf(config: AssistantConfig): string {
  return config.spentNoteKey ?? 'assistant.askOwner';
}
