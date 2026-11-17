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
  /** Stops the clock of every toast on screen, keeping the time each has left; one that comes meanwhile waits too. */
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

/**
 * `toasts` with `toast` on it: in the place of the one with its id at the same edge, else last. Moved to the other
 * edge it is new there: kept in its old turn, it could push one on screen back to waiting.
 */
function placed(toasts: readonly Toast[], toast: Toast): readonly Toast[] {
  const previous = toasts.find((each) => each.id === toast.id);
  return previous?.position === toast.position
    ? toasts.map((each) => (each.id === toast.id ? toast : each))
    : [...toasts.filter((each) => each.id !== toast.id), toast];
}

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
    const now = Date.now();
    for (const clock of clocks.values()) {
      if (clock.timer === undefined) continue;
      clearTimeout(clock.timer);
      clock.timer = undefined;
      clock.left -= now - clock.since;
    }
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

  return { forget, pause, reset, resume, run };
}

export function createToastStore(): ToastStore {
  // Oldest first, both edges together: the first three of an edge are on screen, the rest wait their turn.
  const toasts = shallowRef<readonly Toast[]>([]);
  const clocks = createClocks((id) => dismiss(id));

  const onScreen = (position: ToastPosition): ComputedRef<readonly Toast[]> =>
    computed(() =>
      toasts.value
        .filter((toast) => toast.position === position)
        .slice(0, ON_SCREEN_PER_EDGE)
        .reverse(),
    );
  const bottom = onScreen('bottom');
  const top = onScreen('top');
  const idsOnScreen = (): string[] => [...bottom.value, ...top.value].map((toast) => toast.id);

  function show(options: ToastOptions): string {
    const toast = toastOf(options);
    clocks.reset(toast.id, toast.duration);
    toasts.value = placed(toasts.value, toast);
    clocks.run(idsOnScreen());
    return toast.id;
  }

  function dismiss(id: string): boolean {
    if (!toasts.value.some((toast) => toast.id === id)) return false;
    clocks.forget(id);
    toasts.value = toasts.value.filter((toast) => toast.id !== id);
    clocks.run(idsOnScreen());
    return true;
  }

  function runAction(id: string): void {
    const action = toasts.value.find((toast) => toast.id === id)?.action;
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
