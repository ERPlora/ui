// One per tab: it outlives the panel's component (remounted when the person changes) and a turn goes on while the panel
// is closed. A question goes out with the whole conversation and its answer arrives into one bubble, from every round
// of its turn (`./turn`); a write stops on its card until `decide`.
import { reactive } from 'vue';

import { assistantConfig } from './config';
import { type Bubble, type ContentPart, clearThread, emptyThread, loadThread, saveThread } from './history';
import { type Decision, postTurn } from './stream';
import { run, type TurnContext, type TurnDeps, type TurnState } from './turn';

export const OPEN_KEY = 'erplora.assistant.open';

export interface Attachment {
  name: string;
  mime: string;
  /** Base64, without the `data:` prefix. */
  data: string;
}

export interface AssistantState extends TurnState {
  open: boolean;
  /** What the person is writing and attaching, not sent yet. */
  draft: string;
  files: Attachment[];
}

export interface AssistantDeps extends TurnDeps {
  openStorage?: Storage;
  id?: () => string;
}

/** The tab's assistant: what its turns share, and what only the panel uses. */
interface Session extends TurnContext {
  state: AssistantState;
  openStorage?: Storage;
  id: () => string;
}

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

function setOpen(s: Session, open: boolean): void {
  s.state.open = open;
  try {
    s.openStorage?.setItem(OPEN_KEY, open ? '1' : '0');
  } catch {
    // A storage that refuses: the panel stays as it is until the page reloads.
  }
}

function abort(s: Session): void {
  s.controller?.abort();
  s.controller = null;
}

function reset(s: Session, user: string): void {
  const { state } = s;
  abort(s);
  s.turn = null;
  state.thread = emptyThread(user);
  state.busy = false;
  state.confirm = null;
  state.draft = '';
  state.files = [];
}

/** The person of the session: another one than the thread's starts empty, with the panel closed. */
function forUser(s: Session, user: string): void {
  if (s.state.thread.user === user) return;
  const changed = s.state.thread.user !== '';
  reset(s, user);
  s.state.thread = loadThread(s.storage, user);
  if (changed) setOpen(s, false);
}

/** The empty bubble of the answer to `question`, and its turn. */
function begin(s: Session, question: string): void {
  const bubble: Bubble = { id: s.id(), role: 'assistant', text: '', files: [], notices: [], done: false, question };
  s.state.thread.bubbles.push(bubble);
  // The reactive copy: what the frames write is what the panel paints.
  s.turn = { bubble: s.state.thread.bubbles.at(-1)!, question, pending: [], continuation: null, executed: [], results: [], web: false };
}

async function ask(s: Session, text: string, options: { setup?: boolean }): Promise<void> {
  const { state } = s;
  const question = text.trim();
  const files = [...state.files];
  if (state.busy || (!question && files.length === 0)) return;
  if (options.setup) state.thread.setup = true;
  state.thread.bubbles.push({ id: s.id(), role: 'user', text: question, files: files.map((file) => file.name), notices: [], done: true });
  state.thread.conversation.push({ role: 'user', content: contentOf(question, files) });
  state.draft = '';
  state.files = [];
  begin(s, question);
  saveThread(s.storage, state.thread);
  await run(s);
}

/** The person's answer to the card: yes (with what it typed), no, or «Cancel all» (`stop`). */
async function decide(s: Session, answer: Omit<Decision, 'call_id'>): Promise<void> {
  if (!s.state.confirm || !s.turn) return;
  const { call } = s.state.confirm;
  s.state.confirm = null;
  await run(s, { call_id: call.call_id, ...answer });
}

/** «Stop»: the request in flight is aborted (what was written stays); a card waiting is cancelled with the rest. */
function stop(s: Session): void {
  if (s.state.confirm) {
    void decide(s, { accepted: false, typed: '', stop: true });
    return;
  }
  abort(s);
}

/** Ask the last question again, after a failure. */
async function retry(s: Session): Promise<void> {
  const { state } = s;
  if (state.busy) return;
  const last = state.thread.bubbles.at(-1);
  if (!last || last.role !== 'assistant' || !last.error) return;
  const question = last.question ?? '';
  state.thread.bubbles.pop();
  if (state.thread.conversation.at(-1)?.role !== 'user') {
    state.thread.conversation.push({ role: 'user', content: question });
  }
  begin(s, question);
  await run(s);
}

function newConversation(s: Session): void {
  reset(s, s.state.thread.user);
  clearThread(s.storage);
}

/** Forget everything of this tab (signing out). */
function forget(s: Session): void {
  reset(s, '');
  clearThread(s.storage);
}

function openForSetup(s: Session): void {
  s.state.thread.setup = true;
  setOpen(s, true);
  saveThread(s.storage, s.state.thread);
}

export function createAssistant(deps: AssistantDeps) {
  const state = reactive<AssistantState>({
    open: readOpen(deps.openStorage),
    thread: emptyThread(''),
    busy: false,
    confirm: null,
    usage: null,
    draft: '',
    files: [],
  });
  const s: Session = {
    state,
    post: deps.post,
    approval: deps.approval,
    imageNames: deps.imageNames,
    storage: deps.storage,
    openStorage: deps.openStorage,
    id: deps.id ?? (() => globalThis.crypto.randomUUID()),
    screenExists: () => true,
    turn: null,
    controller: null,
  };
  return {
    state,
    forUser: (user: string) => forUser(s, user),
    setOpen: (open: boolean) => setOpen(s, open),
    toggle: () => setOpen(s, !state.open),
    ask: (text: string, options: { setup?: boolean } = {}) => ask(s, text, options),
    decide: (accepted: boolean, typed = '', stop = false) => decide(s, { accepted, typed, stop }),
    stop: () => stop(s),
    retry: () => retry(s),
    newConversation: () => newConversation(s),
    forget: () => forget(s),
    openForSetup: () => openForSetup(s),
    setScreenCheck(check: (path: string) => boolean) {
      s.screenExists = check;
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
      imageNames: config.imageNames,
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
