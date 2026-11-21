// One per tab: it outlives the panel's component (remounted when the person changes) and a turn goes on while the panel
// is closed. A question goes out with the whole conversation and its answer arrives into one bubble, from every round;
// the reads the model asks for go on by themselves, and a write stops on its card until `decide`. The bubble keeps
// whether its answer may quote pages of the web, for its report: a round that wrote without saying leaves it unknown.
// An approval nobody gave is heard by the model as a «Cancel».
import { reactive } from 'vue';

import { ApiError } from '../../sdk/errors';
import type { AssistantCard } from './card';
import { type AssistantApproval, assistantConfig, type AssistantUsage } from './config';
import { groundingNotices } from './grounding';
import { type Bubble, type ContentPart, clearThread, emptyThread, loadThread, saveThread, type Thread } from './history';
import { bodyOf, cancelOf, frameReader, markWeb, newRound, type Round, settle, type Turn } from './round';
import { type Decision, type PendingCall, postTurn, type TurnBody, type TurnOptions } from './stream';

export const OPEN_KEY = 'erplora.assistant.open';

export interface Attachment {
  name: string;
  mime: string;
  /** Base64, without the `data:` prefix. */
  data: string;
}

export interface AssistantState {
  open: boolean;
  thread: Thread;
  /** A turn in flight, or a card waiting for its answer. */
  busy: boolean;
  /** The card of the write that waits; `more`: other actions wait behind it («Cancel all»). */
  confirm: { card: AssistantCard; call: PendingCall; more: boolean } | null;
  usage: AssistantUsage | null;
  /** What the person is writing and attaching, not sent yet. */
  draft: string;
  files: Attachment[];
}

export interface AssistantDeps {
  /** Sends a request of a turn and hands each frame of its answer to `onFrame`. */
  post: (body: TurnBody, options: TurnOptions) => Promise<void>;
  /** The host's approval of a request (the Hub's manager approval); none: each request runs as it is. */
  approval?: AssistantApproval;
  storage?: Storage;
  openStorage?: Storage;
  id?: () => string;
}

/** What follows a round: another one, carrying the answer the model hears for a call, if any; or nothing (`null`). */
type Next = { decision?: Decision } | null;

function readOpen(storage: Storage | undefined): boolean {
  try {
    return storage?.getItem(OPEN_KEY) === '1';
  } catch {
    return false;
  }
}

function contentOf(text: string, files: Attachment[]): string | ContentPart[] {
  if (files.length === 0) return text;
  const parts: ContentPart[] = text ? [{ type: 'text', text }] : [];
  for (const file of files) {
    if (file.mime.startsWith('image/')) {
      parts.push({ type: 'image_url', image_url: { url: `data:${file.mime};base64,${file.data}` }, filename: file.name });
    } else {
      parts.push({ type: 'input_file', filename: file.name, mime_type: file.mime, data: file.data });
    }
  }
  return parts;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function createAssistant(deps: AssistantDeps) {
  const post = deps.post;
  const approval = deps.approval;
  const storage = deps.storage;
  const openStorage = deps.openStorage;
  const id = deps.id ?? (() => globalThis.crypto.randomUUID());
  const state = reactive<AssistantState>({
    open: readOpen(openStorage),
    thread: emptyThread(''),
    busy: false,
    confirm: null,
    usage: null,
    draft: '',
    files: [],
  });
  let controller: AbortController | null = null;
  let turn: Turn | null = null;
  let screenExists: (path: string) => boolean = () => true;

  const save = () => saveThread(storage, state.thread);

  function setOpen(open: boolean): void {
    state.open = open;
    try {
      openStorage?.setItem(OPEN_KEY, open ? '1' : '0');
    } catch {
      // A storage that refuses: the panel stays as it is until the page reloads.
    }
  }

  function abort(): void {
    controller?.abort();
    controller = null;
  }

  function reset(user: string): void {
    abort();
    turn = null;
    state.thread = emptyThread(user);
    state.busy = false;
    state.confirm = null;
    state.draft = '';
    state.files = [];
  }

  /** The person of the session: another one than the thread's starts empty, with the panel closed. */
  function forUser(user: string): void {
    if (state.thread.user === user) return;
    const changed = state.thread.user !== '';
    reset(user);
    state.thread = loadThread(storage, user);
    if (changed) setOpen(false);
  }

  /** Ends the turn; no round follows it (`null`). */
  function finish(error?: string, details?: Record<string, unknown>, stopped = false): null {
    if (!turn) return null;
    const { bubble } = turn;
    bubble.done = true;
    if (error) {
      bubble.error = error;
      if (details) bubble.details = details;
    }
    if (stopped) bubble.stopped = true;
    bubble.executed = turn.executed
      .filter((row) => row.kind === 'command')
      .map((row) => ({ name: row.name, app: row.app ?? '', app_name: row.app_name, screen: row.screen, outcome: row.outcome }));
    if (bubble.text) {
      bubble.notices = groundingNotices({
        answer: bubble.text,
        executed: turn.executed,
        results: turn.results,
        question: turn.question,
        screenExists,
      });
    }
    turn = null;
    controller = null;
    state.busy = false;
    state.confirm = null;
    save();
    return null;
  }

  /** A write someone must approve (the Hub's manager): the host asks, then the same request with the pass. */
  function send(body: TurnBody, options: TurnOptions): Promise<void> {
    const request = () => post(body, options);
    return approval ? approval.run(request) : request();
  }

  /** A request that failed: «Stop», a write nobody approved (not done, and the model hears a «Cancel»), or the failure. */
  function afterFailure(error: unknown, sent: Decision | undefined): Next {
    if (isAbort(error)) return finish(undefined, undefined, true);
    if (approval?.declined(error) && sent?.accepted) return { decision: cancelOf(sent.call_id) };
    const code = error instanceof ApiError ? error.code : 'assistant.unreachable';
    return finish(code, error instanceof ApiError ? (error.details ?? {}) : {});
  }

  /** A round that arrived whole: it failed, stops on a card, ends the answer, or the reads it asked for go on. */
  function afterRound(current: Turn, said: Round): Next {
    if (said.failure) return finish(said.failure.code, said.failure.details);
    const waiting = said.confirm;
    if (waiting && waiting.card.blocked) {
      // Not done from the chat (a dangerous write that names no record): no card, the model hears it and says where.
      current.bubble.blocked = true;
      return { decision: cancelOf(waiting.call.call_id) };
    }
    if (waiting) {
      state.confirm = { ...waiting, more: current.pending.length > 1 };
      save();
      return null;
    }
    if (!said.done) return finish('assistant.cut');
    if (current.pending.length === 0) return finish();
    return {};
  }

  /** One request of the turn and its answer; a turn that another one replaced is left as it is. */
  async function round(current: Turn, decision: Decision | undefined): Promise<Next> {
    controller = new AbortController();
    const said = newRound();
    const onFrame = frameReader(current, said, (usage) => {
      state.usage = usage;
    });
    const body = bodyOf(current, state.thread, decision);
    try {
      await send(body, { onFrame, signal: controller.signal });
    } catch (error) {
      if (turn !== current) return null;
      markWeb(current, said);
      return afterFailure(error, body.decision);
    }
    if (turn !== current) return null;
    markWeb(current, said);
    if (said.done) settle(current, state.thread.conversation, said.done);
    return afterRound(current, said);
  }

  async function run(decision?: Decision): Promise<void> {
    if (!turn) return;
    state.busy = true;
    let next: Next = { decision };
    while (next) next = await round(turn, next.decision);
  }

  async function ask(text: string, options: { setup?: boolean } = {}): Promise<void> {
    const question = text.trim();
    const files = [...state.files];
    if (state.busy || (!question && files.length === 0)) return;
    if (options.setup) state.thread.setup = true;
    state.thread.bubbles.push({ id: id(), role: 'user', text: question, files: files.map((file) => file.name), notices: [], done: true });
    state.thread.conversation.push({ role: 'user', content: contentOf(question, files) });
    state.draft = '';
    state.files = [];
    const bubble: Bubble = { id: id(), role: 'assistant', text: '', files: [], notices: [], done: false, question };
    state.thread.bubbles.push(bubble);
    // The reactive copy: what the frames write is what the panel paints.
    turn = { bubble: state.thread.bubbles.at(-1)!, question, pending: [], continuation: null, executed: [], results: [], web: false };
    save();
    await run();
  }

  /** The person's answer to the card: yes (with what it typed), no, or «Cancel all» (`stop`). */
  async function decide(accepted: boolean, typed = '', stop = false): Promise<void> {
    if (!state.confirm || !turn) return;
    const { call } = state.confirm;
    state.confirm = null;
    await run({ call_id: call.call_id, accepted, typed, stop });
  }

  /** «Stop»: the request in flight is aborted (what was written stays); a card waiting is cancelled with the rest. */
  function stop(): void {
    if (state.confirm) {
      void decide(false, '', true);
      return;
    }
    abort();
  }

  /** Ask the last question again, after a failure. */
  async function retry(): Promise<void> {
    if (state.busy) return;
    const last = state.thread.bubbles.at(-1);
    if (!last || last.role !== 'assistant' || !last.error) return;
    const question = last.question ?? '';
    state.thread.bubbles.pop();
    if (state.thread.conversation.at(-1)?.role !== 'user') {
      state.thread.conversation.push({ role: 'user', content: question });
    }
    const bubble: Bubble = { id: id(), role: 'assistant', text: '', files: [], notices: [], done: false, question };
    state.thread.bubbles.push(bubble);
    turn = { bubble: state.thread.bubbles.at(-1)!, question, pending: [], continuation: null, executed: [], results: [], web: false };
    await run();
  }

  function newConversation(): void {
    const user = state.thread.user;
    reset(user);
    clearThread(storage);
  }

  /** Forget everything of this tab (signing out). */
  function forget(): void {
    reset('');
    clearThread(storage);
  }

  function openForSetup(): void {
    state.thread.setup = true;
    setOpen(true);
    save();
  }

  return {
    state,
    forUser,
    setOpen,
    toggle: () => setOpen(!state.open),
    ask,
    decide,
    stop,
    retry,
    newConversation,
    forget,
    openForSetup,
    setScreenCheck(check: (path: string) => boolean) {
      screenExists = check;
    },
  };
}

export type Assistant = ReturnType<typeof createAssistant>;

/** The browser's storage, where it can be reached (never in a page that blocks it). */
export function browserStorage(name: 'sessionStorage' | 'localStorage'): Storage | undefined {
  try {
    return globalThis[name];
  } catch {
    return undefined;
  }
}

let shared: Assistant | undefined;

/** The tab's assistant: the same for every component and every mount, posting as the host configured it. */
export function useAssistant(): Assistant {
  if (!shared) {
    const config = assistantConfig();
    shared = createAssistant({
      post: (body, options) => postTurn(body, { ...options, url: config.turnUrl, elevationToken: config.elevationToken }),
      approval: config.approval,
      storage: browserStorage('sessionStorage'),
      openStorage: browserStorage('localStorage'),
    });
  }
  return shared;
}

/** Puts `instance` as the tab's assistant (a test's own), or forgets it (`undefined`). */
export function installAssistant(instance: Assistant | undefined): void {
  shared = instance;
}

/** Signing out forgets the conversation of the tab, even if the panel was never opened. */
export function forgetAssistant(): void {
  if (shared) shared.forget();
  else clearThread(browserStorage('sessionStorage'));
}
