// The one stack of toasts, as data: callers add notices through `toast.ts`, and the one component that paints them
// reads the stack and acts on it through `useToasts()`. Nothing here touches the DOM or Ionic.
import { computed, shallowRef } from 'vue';
import type { ComputedRef } from 'vue';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';
export type ToastPosition = 'bottom' | 'top';

/** A button on the toast that does something (e.g. «Retry»). Running it closes the toast. */
export interface ToastAction {
  readonly label: string;
  readonly run: () => void;
}

/** A notice on the stack. `duration` in ms; 0 keeps it until it is closed. */
export interface Toast {
  readonly id: string;
  readonly message: string;
  readonly tone: ToastTone;
  readonly duration: number;
  readonly action?: ToastAction;
  readonly position: ToastPosition;
}

/** What a caller gives. The stack fills the rest: its own id, the info tone, the tone's time and the bottom edge. */
export type ToastOptions = Pick<Toast, 'message'> & Partial<Omit<Toast, 'message'>>;

/** What the component that paints the toasts reads and does. Each edge lists what is on screen, newest first. */
export interface ToastStack {
  readonly bottom: ComputedRef<readonly Toast[]>;
  readonly top: ComputedRef<readonly Toast[]>;
  /** Stops the clock of every toast on screen, keeping the time each has left. One that comes meanwhile still comes on
   *  screen, and counts its time from the resume. */
  pause(): void;
  resume(): void;
  /** `false` when there was nothing to close: it had left already, or never came. */
  dismiss(id: string): boolean;
  /** Closes the toast and runs its action. */
  runAction(id: string): void;
}

export interface ToastStore extends ToastStack {
  /** Adds a toast, or replaces in its place the one with the same id. Returns its id. */
  show(options: ToastOptions): string;
}

const ON_SCREEN_PER_EDGE = 3;
const EDGES: readonly ToastPosition[] = ['bottom', 'top'];
const DURATION_BY_TONE: Record<ToastTone, number> = { success: 3000, info: 3000, warning: 4000, error: 5000 };

let made = 0;

/** The toast `options` ask for, with what they leave out filled in. */
function toastOf(options: ToastOptions): Toast {
  const tone = options.tone ?? 'info';
  return {
    id: options.id ?? `toast-${++made}`,
    message: options.message,
    tone,
    duration: options.duration ?? DURATION_BY_TONE[tone],
    action: options.action,
    position: options.position ?? 'bottom',
  };
}

/** A toast on the stack, on screen or waiting its turn. */
interface Entry {
  readonly toast: Toast;
  readonly onScreen: boolean;
}

/**
 * `entries` with `toast` on it: in the place of the one with its id at the same edge, else last and waiting. Moved to
 * the other edge it is new there: kept in its old turn, it could push one on screen back to waiting.
 */
function placed(entries: readonly Entry[], toast: Toast): readonly Entry[] {
  const previous = entries.find((each) => each.toast.id === toast.id);
  return previous?.toast.position === toast.position
    ? entries.map((each) => (each.toast.id === toast.id ? { ...each, toast } : each))
    : [...entries.filter((each) => each.toast.id !== toast.id), { toast, onScreen: false }];
}

const isError = (toast: Toast): boolean => toast.tone === 'error';
const leavesByItself = (toast: Toast): boolean => toast.duration !== 0 && toast.action === undefined;
/** The first of `toasts` that is not an error, else the first. */
const notAnErrorFirst = (toasts: readonly Toast[]): Toast | undefined => toasts.find((toast) => !isError(toast)) ?? toasts[0];

/** What makes room for a toast on screen: one that closes now, or one that goes back to waiting. */
interface Room {
  readonly close?: Toast;
  readonly hold?: Toast;
}

/**
 * The room for `newcomer` at an edge with `onScreen` (oldest first); `undefined` when it waits its turn. With a free
 * place nothing has to go. With the three taken, the newest notice is still seen, but it never pushes out one that
 * outranks it, and an error outranks the other tones:
 * 1. the oldest that leaves by itself (it has a time and no action), one that is not an error first, closes now;
 * 2. failing that, an error sends the oldest on screen, one that is not an error first, back to waiting with the time it
 *    had left;
 * 3. failing both, `newcomer` waits.
 */
function roomFor(newcomer: Toast, onScreen: readonly Toast[]): Room | undefined {
  if (onScreen.length < ON_SCREEN_PER_EDGE) return {};
  const pushable = isError(newcomer) ? onScreen : onScreen.filter((toast) => !isError(toast));
  const close = notAnErrorFirst(pushable.filter(leavesByItself));
  if (close) return { close };
  return isError(newcomer) ? { hold: notAnErrorFirst(onScreen) } : undefined;
}

/** The waiting toast (oldest first) that takes a place once one frees: an error before the other tones. */
const nextInLine = (waiting: readonly Toast[]): Toast | undefined => waiting.find(isError) ?? waiting[0];

/** A toast's time on screen: what it has left, and since when its timer runs. */
interface Clock {
  left: number;
  since: number;
  timer?: ReturnType<typeof setTimeout>;
}

/** The time on screen of each toast with one: it counts only while the toast is on screen, and all stop together. */
function createClocks(timeUp: (id: string) => void) {
  const clocks = new Map<string, Clock>();
  let paused = false;

  function forget(id: string): void {
    clearTimeout(clocks.get(id)?.timer);
    clocks.delete(id);
  }

  /** Stops the clock of `id`, keeping the time it has left. */
  function hold(id: string): void {
    const clock = clocks.get(id);
    if (clock?.timer === undefined) return;
    clearTimeout(clock.timer);
    clock.timer = undefined;
    clock.left -= Date.now() - clock.since;
  }

  /** Runs the clock of each of `ids` that is not counting yet. */
  function run(ids: readonly string[]): void {
    if (paused) return;
    for (const id of ids) {
      const clock = clocks.get(id);
      if (!clock || clock.timer !== undefined) continue;
      clock.since = Date.now();
      clock.timer = setTimeout(() => timeUp(id), clock.left);
    }
  }

  function pause(): void {
    paused = true;
    for (const id of clocks.keys()) hold(id);
  }

  /** A clock with the whole of `duration` left; none for a toast that stays until it is closed. */
  function reset(id: string, duration: number): void {
    forget(id);
    if (duration !== 0) clocks.set(id, { left: duration, since: 0 });
  }

  function resume(ids: readonly string[]): void {
    paused = false;
    run(ids);
  }

  return { forget, hold, pause, reset, resume, run };
}

/** The toasts of both edges, oldest first, each on screen or waiting, and the moves between the two. */
function createEntries() {
  const entries = shallowRef<readonly Entry[]>([]);

  const find = (id: string): Entry | undefined => entries.value.find((each) => each.toast.id === id);
  const atEdge = (position: ToastPosition, onScreen: boolean): Toast[] =>
    entries.value
      .filter((each) => each.toast.position === position && each.onScreen === onScreen)
      .map((each) => each.toast);

  function setOnScreen(id: string, onScreen: boolean): void {
    entries.value = entries.value.map((each) => (each.toast.id === id ? { ...each, onScreen } : each));
  }

  function place(toast: Toast): void {
    entries.value = placed(entries.value, toast);
  }

  function remove(id: string): void {
    entries.value = entries.value.filter((each) => each.toast.id !== id);
  }

  /** Puts `toast`, which waits, on screen if its edge has room for it ({@link roomFor}); returns the room it took. */
  function admit(toast: Toast): Room | undefined {
    const room = roomFor(toast, atEdge(toast.position, true));
    if (!room) return undefined;
    if (room.close) remove(room.close.id);
    if (room.hold) setOnScreen(room.hold.id, false);
    setOnScreen(toast.id, true);
    return room;
  }

  /** Gives the free places of `position` to the toasts waiting there. */
  function fill(position: ToastPosition): void {
    for (let free = ON_SCREEN_PER_EDGE - atEdge(position, true).length; free > 0; free--) {
      const next = nextInLine(atEdge(position, false));
      if (!next) return;
      setOnScreen(next.id, true);
    }
  }

  return { find, atEdge, place, remove, admit, fill };
}

export function createToastStore(): ToastStore {
  const entries = createEntries();
  const clocks = createClocks((id) => dismiss(id));

  const onScreen = (position: ToastPosition): ComputedRef<readonly Toast[]> =>
    computed(() => entries.atEdge(position, true).reverse());
  const bottom = onScreen('bottom');
  const top = onScreen('top');
  const idsOnScreen = (): string[] => [...bottom.value, ...top.value].map((toast) => toast.id);

  function admit(toast: Toast): void {
    const room = entries.admit(toast);
    if (room?.close) clocks.forget(room.close.id);
    if (room?.hold) clocks.hold(room.hold.id);
  }

  function show(options: ToastOptions): string {
    const toast = toastOf(options);
    const previous = entries.find(toast.id);
    clocks.reset(toast.id, toast.duration);
    entries.place(toast);
    if (!(previous?.onScreen && previous.toast.position === toast.position)) admit(toast);
    for (const edge of EDGES) entries.fill(edge);
    clocks.run(idsOnScreen());
    return toast.id;
  }

  function dismiss(id: string): boolean {
    const entry = entries.find(id);
    if (!entry) return false;
    clocks.forget(id);
    entries.remove(id);
    entries.fill(entry.toast.position);
    clocks.run(idsOnScreen());
    return true;
  }

  function runAction(id: string): void {
    const action = entries.find(id)?.toast.action;
    if (!action) return;
    dismiss(id);
    action.run();
  }

  return {
    bottom,
    top,
    show,
    dismiss,
    pause: clocks.pause,
    resume: () => clocks.resume(idsOnScreen()),
    runAction,
  };
}

/** The stack of the page, filled by `toast.ts`. */
export const toastStore = createToastStore();

export function useToasts(): ToastStack {
  const { bottom, top, pause, resume, dismiss, runAction } = toastStore;
  return { bottom, top, pause, resume, dismiss, runAction };
}
