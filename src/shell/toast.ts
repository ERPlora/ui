// Global feedback for an action, as data: a caller says what happened and the one toast component the shell mounts
// paints it (`toast-store.ts` keeps the stack). No template carries its own toast.
import { toastStore } from './toast-store';
import type { ToastOptions, ToastTone } from './toast-store';

/** Everything of a notice but its message and tone, which a shortcut sets. */
type ToastExtras = Omit<ToastOptions, 'message' | 'tone'>;

/**
 * Shows a toast and returns its id. `tone` sets its look and its time on screen (info by default); `duration` in ms
 * overrides that time, and 0 keeps it until it is closed. `id` names it, so a second notice with the same id replaces
 * the first and {@link dismissToast} can withdraw it once what it says stops being true. `action` adds a button that
 * runs and closes the toast. `position: 'top'` is for a notice that shares the screen with a sheet's keys at the
 * bottom edge.
 */
export function toast(options: ToastOptions): string {
  return toastStore.show(options);
}

/** Withdraws the toast with `id`. `false` when there is none any more: a notice already gone is not a failure. */
export function dismissToast(id: string): boolean {
  return toastStore.dismiss(id);
}

const withTone =
  (tone: ToastTone) =>
  (message: string, options: ToastExtras = {}): string =>
    toast({ ...options, message, tone });

export const toastSuccess = withTone('success');
export const toastError = withTone('error');
export const toastInfo = withTone('info');
export const toastWarning = withTone('warning');
