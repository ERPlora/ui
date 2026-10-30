// What the host gives the assistant's chat (the Hub, the SaaS: the same chat, each with its own tools), set once when
// the app boots, before anything mounts:
//   configureAssistant({ turnUrl: '/api/assistant/turn', usage: (client) => client.api.call('<app>.assistant.usage', {}) })
// - `turnUrl`: the route a turn is POSTed to; its answer is the stream of frames (`stream.ts`).
// - Around the chat, each optional — without it, that piece is not there: the month's allowance (`usage`), dictation
//   (`transcribe`), «Report a problem» under an answer (`report`), «Upgrade plan» (`planUrl` + `canUpgrade`).
// - Who sees the assistant's button (`canUse`; everyone signed in by default).
// - The host's words: the verb of each write (`verbKey`), the platform's screens a receipt names (`placeKey`) and those
//   a path is (`screenKey`), as keys of the host's own catalogue; the chat's own words are `assistantMessages`.
// - A request of a turn that needs someone's approval (`approval`, `elevationToken`: the Hub's manager approval).
// The client the reads and writes go through is the page's live client (`useLiveClient`), passed to each.
import type { LiveClient } from '../../sdk/live-client';
import type { ShellSession } from '../../shell/session';

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

/** What is wrong with an answer, as the person reports it. */
export interface AssistantReportInput {
  message_id: string;
  reason: 'incorrect' | 'harmful' | 'instructions' | 'other';
  comment?: string;
  question?: string;
  answer: string;
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
  /** Who sees the assistant's button; everyone signed in when not given. */
  canUse?: (session: ShellSession) => boolean;
  /** Who may upgrade the plan (only ever offered on the web); nobody when not given. */
  canUpgrade?: (session: ShellSession) => boolean;
  /** The page where the plan is upgraded. */
  planUrl?: () => string;
  /** The key of the verb of a write, by its operation (`<app>.<entity>.<action>`); «Do this» when not given. */
  verbKey?: (operation: string) => string;
  /** The key of the name of a platform screen a receipt names (the server's `screen`); none: the app's name. */
  placeKey?: (screen: string | undefined) => string | null;
  /** The key of the name of a platform screen by its path (`/settings`); none: the menu's name. */
  screenKey?: (path: string) => string | null;
}

let current: AssistantConfig | undefined;

/** Sets the host's configuration (`undefined` forgets it: a test's own). */
export function configureAssistant(config: AssistantConfig | undefined): void {
  current = config;
}

/** The host's configuration; a host that never set it is a bug, said at once. */
export function assistantConfig(): AssistantConfig {
  if (!current) throw new Error('assistant: configureAssistant() was not called before the assistant was used');
  return current;
}

/** The key of the verb of a write: the host's, else «Do this». */
export function verbKeyOf(config: AssistantConfig, operation: string): string {
  return config.verbKey?.(operation) ?? 'assistant.card.other';
}
