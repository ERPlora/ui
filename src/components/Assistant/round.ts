// One round of a turn: a request with the whole conversation and what the turn still owes (the continuation, the
// pending calls, the person's answer to a card), and the frames of its answer, written into the turn as they arrive.
import type { AssistantCard } from './card';
import type { AssistantUsage } from './config';
import type { Executed } from './grounding';
import type { Bubble, ChatMessage, Thread } from './history';
import { type Decision, fromTheWeb, type PendingCall, type TurnBody, type TurnFrame } from './stream';

export interface Turn {
  bubble: Bubble;
  question: string;
  pending: PendingCall[];
  continuation: string | null;
  executed: Executed[];
  results: string[];
  /** Whether the answer may quote pages of the web, so far (`fromTheWeb`): no round yet brought any. */
  web: boolean | undefined;
  /** The web addresses the host's own tools consulted so far (`done.sources`); none while no round said. */
  sources?: string[];
}

type DoneFrame = Extract<TurnFrame, { type: 'done' }>;
type ErrorFrame = Extract<TurnFrame, { type: 'error' }>;
type ExecutedFrame = Extract<TurnFrame, { type: 'executed' }>;

interface Failure {
  code: string;
  details: Record<string, unknown>;
}

/** What the frames of one round brought, besides the text they wrote into the bubble. */
export interface Round {
  done: DoneFrame | null;
  confirm: { card: AssistantCard; call: PendingCall } | null;
  failure: Failure | null;
  spoke: boolean;
}

export function newRound(): Round {
  return { done: null, confirm: null, failure: null, spoke: false };
}

/** What a round already wrote, ready for the next one to start its own paragraph: a blank line, never two. */
function asNewParagraph(text: string): string {
  if (!text || text.endsWith('\n\n')) return text;
  return text.endsWith('\n') ? `${text}\n` : `${text}\n\n`;
}

function write(turn: Turn, round: Round, text: string): void {
  if (!round.spoke && text) {
    turn.bubble.text = asNewParagraph(turn.bubble.text);
    round.spoke = true;
  }
  turn.bubble.text += text;
}

function failureOf(frame: ErrorFrame): Failure {
  const { code, ...rest } = frame;
  const details: Record<string, unknown> = { ...rest };
  delete details.type;
  return { code, details };
}

/** The foot counts what the refusal counts: «5 left» under «30 of 30» contradicts it. */
function usageOfRefusal({ code, details }: Failure): AssistantUsage | null {
  if (code !== 'assistant.quota_exceeded' || typeof details.used !== 'number' || typeof details.limit !== 'number') return null;
  const resets = details.resets_at;
  return { used: details.used, limit: details.limit, resets_at: typeof resets === 'string' ? resets : null, demo: details.demo === true };
}

function refuse(round: Round, frame: ErrorFrame, onUsage: (usage: AssistantUsage) => void): void {
  round.failure = failureOf(frame);
  const usage = usageOfRefusal(round.failure);
  if (usage) onUsage(usage);
}

/** What ran, for the receipts and the check of the answer; a file a read handed goes under the answer right away. */
function ran(turn: Turn, frame: ExecutedFrame): void {
  turn.executed.push({ name: frame.name, kind: frame.kind, outcome: frame.outcome, app: frame.app, app_name: frame.app_name, screen: frame.screen, reason: frame.reason });
  if (frame.file) (turn.bubble.handed ??= []).push(frame.file);
}

/** Writes each frame of a round into its turn as it arrives; the month's usage it reports goes to `onUsage`. */
export function frameReader(turn: Turn, round: Round, onUsage: (usage: AssistantUsage) => void): (frame: TurnFrame) => void {
  return (frame) => {
    if (frame.type === 'text') write(turn, round, frame.text);
    else if (frame.type === 'executed') ran(turn, frame);
    else if (frame.type === 'usage') onUsage({ used: frame.used, limit: frame.limit, resets_at: frame.resets_at, demo: frame.demo });
    else if (frame.type === 'confirm') round.confirm = { card: frame.card, call: frame.call };
    else if (frame.type === 'error') refuse(round, frame, onUsage);
    else if (frame.type === 'done') round.done = frame;
  };
}

/** What a round adds to where the answer came from: its `done`'s word, or, without one, unknown if it wrote. */
export function markWeb(turn: Turn, round: Round): void {
  turn.web = fromTheWeb(turn.web, round.done ? round.done.web : round.spoke ? undefined : false);
  turn.bubble.web = turn.web;
}

/** The conversation as the gateway takes it: an image's file name is the panel's, not a field of its part. */
function withoutImageNames(conversation: ChatMessage[]): ChatMessage[] {
  return conversation.map((message) =>
    Array.isArray(message.content)
      ? {
          ...message,
          content: message.content.map((part) => (part.type === 'image_url' ? { type: part.type, image_url: part.image_url } : part)),
        }
      : message,
  );
}

/** The request of a round of `turn`, in the conversation of `host.thread`: each attached image with its name only for a
 *  host whose turn takes it (`imageNames`). */
export function bodyOf(turn: Turn, host: { thread: Thread; imageNames?: boolean }, decision: Decision | undefined): TurnBody {
  const { thread } = host;
  const messages = host.imageNames ? thread.conversation : withoutImageNames(thread.conversation);
  const body: TurnBody = { messages, setup: thread.setup };
  if (turn.continuation) body.continuation = turn.continuation;
  if (turn.pending.length) body.pending = turn.pending;
  if (decision) body.decision = decision;
  return body;
}

/** What a round's `done` leaves: the messages it appended, the tools' results and the addresses the host's own tools
 *  consulted (to check the answer against), and what the next round owes. */
export function settle(turn: Turn, conversation: ChatMessage[], closed: DoneFrame): void {
  conversation.push(...closed.append);
  for (const message of closed.append) {
    if (message.role === 'tool' && typeof message.content === 'string') turn.results.push(message.content);
  }
  if (closed.sources) (turn.sources ??= []).push(...closed.sources);
  turn.pending = closed.pending;
  turn.continuation = closed.continuation;
}

/** A call that is not done, as the model hears it: a «Cancel». */
export function cancelOf(callId: string): Decision {
  return { call_id: callId, accepted: false, typed: '', stop: false };
}
