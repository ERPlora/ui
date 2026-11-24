// A turn of the conversation: one request per round until its answer ends, fails or stops on a card. The reads the model
// asks for go on by themselves. The bubble keeps whether its answer may quote pages of the web, for its report: a round
// that wrote without saying leaves it unknown. An approval nobody gave is heard by the model as a «Cancel».
import { ApiError } from '../../sdk/errors';
import type { AssistantCard } from './card';
import type { AssistantApproval, AssistantUsage } from './config';
import { groundingNotices } from './grounding';
import { saveThread, type Thread } from './history';
import { bodyOf, cancelOf, frameReader, markWeb, newRound, type Round, settle, type Turn } from './round';
import type { Decision, PendingCall, TurnBody, TurnOptions } from './stream';

/** What a turn writes of the assistant's state. */
export interface TurnState {
  thread: Thread;
  /** A turn in flight, or a card waiting for its answer. */
  busy: boolean;
  /** The card of the write that waits; `more`: other actions wait behind it («Cancel all»). */
  confirm: { card: AssistantCard; call: PendingCall; more: boolean } | null;
  usage: AssistantUsage | null;
}

/** How the requests of a turn go out, and where its thread is kept. */
export interface TurnDeps {
  /** Sends a request of a turn and hands each frame of its answer to `onFrame`. */
  post: (body: TurnBody, options: TurnOptions) => Promise<void>;
  /** The host's approval of a request (the Hub's manager approval); none: each request runs as it is. */
  approval?: AssistantApproval;
  storage?: Storage;
}

/** What the assistant shares with its turns: the turn and the request in flight are one for both sides. */
export interface TurnContext extends TurnDeps {
  state: TurnState;
  screenExists: (path: string) => boolean;
  turn: Turn | null;
  controller: AbortController | null;
}

/** What follows a round: another one, carrying the answer the model hears for a call, if any; or nothing (`null`). */
type Next = { decision?: Decision } | null;

/** How a turn ends: the code of its failure with its numbers, or a «Stop». */
interface End {
  error?: string;
  details?: Record<string, unknown>;
  stopped?: boolean;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Ends the turn; no round follows it (`null`). */
function finish(s: TurnContext, end: End = {}): null {
  const { turn, state } = s;
  if (!turn) return null;
  const { bubble } = turn;
  bubble.done = true;
  if (end.error) {
    bubble.error = end.error;
    if (end.details) bubble.details = end.details;
  }
  if (end.stopped) bubble.stopped = true;
  bubble.executed = turn.executed
    .filter((row) => row.kind === 'command')
    .map((row) => ({ name: row.name, app: row.app ?? '', app_name: row.app_name, screen: row.screen, outcome: row.outcome, reason: row.reason }));
  if (bubble.text) {
    bubble.notices = groundingNotices({
      answer: bubble.text,
      executed: turn.executed,
      results: turn.results,
      question: turn.question,
      sources: turn.sources,
      screenExists: s.screenExists,
    });
  }
  s.turn = null;
  s.controller = null;
  state.busy = false;
  state.confirm = null;
  saveThread(s.storage, state.thread);
  return null;
}

/** A write someone must approve (the Hub's manager): the host asks, then the same request with the pass. */
function send(s: TurnContext, body: TurnBody, options: TurnOptions): Promise<void> {
  const { post, approval } = s;
  const request = () => post(body, options);
  return approval ? approval.run(request) : request();
}

/** A request that failed: «Stop», a write nobody approved (not done, and the model hears a «Cancel»), or the failure. */
function afterFailure(s: TurnContext, error: unknown, sent: Decision | undefined): Next {
  if (isAbort(error)) return finish(s, { stopped: true });
  if (s.approval?.declined(error) && sent?.accepted) return { decision: cancelOf(sent.call_id) };
  const code = error instanceof ApiError ? error.code : 'assistant.unreachable';
  return finish(s, { error: code, details: error instanceof ApiError ? (error.details ?? {}) : {} });
}

/** A round that arrived whole: it failed, stops on a card, ends the answer, or the reads it asked for go on. */
function afterRound(s: TurnContext, current: Turn, said: Round): Next {
  if (said.failure) return finish(s, { error: said.failure.code, details: said.failure.details });
  const waiting = said.confirm;
  if (waiting && waiting.card.blocked) {
    // Not done from the chat (a dangerous write that names no record): no card, the model hears it and says where.
    current.bubble.blocked = true;
    return { decision: cancelOf(waiting.call.call_id) };
  }
  if (waiting) {
    s.state.confirm = { ...waiting, more: current.pending.length > 1 };
    saveThread(s.storage, s.state.thread);
    return null;
  }
  if (!said.done) return finish(s, { error: 'assistant.cut' });
  if (current.pending.length === 0) return finish(s);
  return {};
}

/** One request of the turn and its answer; a turn that another one replaced is left as it is. */
async function round(s: TurnContext, current: Turn, decision: Decision | undefined): Promise<Next> {
  s.controller = new AbortController();
  const said = newRound();
  const onFrame = frameReader(current, said, (usage) => { s.state.usage = usage; });
  const body = bodyOf(current, s.state.thread, decision);
  try {
    await send(s, body, { onFrame, signal: s.controller.signal });
  } catch (error) {
    if (s.turn !== current) return null;
    markWeb(current, said);
    return afterFailure(s, error, body.decision);
  }
  if (s.turn !== current) return null;
  markWeb(current, said);
  if (said.done) settle(current, s.state.thread.conversation, said.done);
  return afterRound(s, current, said);
}

/** Drives the turn it starts with; between two rounds Vue may run watchers that end it or hand the panel over. */
export async function run(s: TurnContext, decision?: Decision): Promise<void> {
  const current = s.turn;
  if (!current) return;
  s.state.busy = true;
  let next: Next = { decision };
  while (next && s.turn === current) next = await round(s, current, next.decision);
}
