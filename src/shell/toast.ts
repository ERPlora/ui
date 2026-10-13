// Ported from ERPlora hub apps/web/src/lib/toast.ts, without its `bootActionFeedback`: that hook
// listened on `window` for the CSV events of OutfitKit's Web Components table, which is gone
// (PLAN §16.11).
// Global action feedback (success / error / info). Centralises what every page used to reinvent
// with its own `<ion-toast>` (Apps/Files/System). It uses Ionic's imperative `toastController`:
// it queues and stacks on its own, no `<ion-toast>` in any template.
import { toastController } from '@ionic/vue';

import { shellText } from './i18n';

export type ToastColor = 'success' | 'danger' | 'medium' | 'primary' | 'warning';

/** A button that does something, shown before the close button (e.g. «Retry», hub#2494). */
export interface ToastAction {
  text: string;
  handler: () => void;
}

/**
 * Shows a global toast. `duration` in ms (0 = sticky, closed by its button, labelled in the language
 * of the page: `toast.close` of the shell catalogue). `id` names it so
 * {@link dismissToast} can withdraw it once what it says stops being true. `action` adds a button
 * that runs its handler (and closes the toast).
 */
export async function toast(
  message: string,
  color: ToastColor = 'medium',
  duration = 2600,
  id?: string,
  action?: ToastAction,
): Promise<void> {
  const t = await toastController.create({
    message,
    color,
    duration,
    position: 'bottom',
    buttons: [
      ...(action ? [{ text: action.text, handler: action.handler }] : []),
      { text: shellText('toast.close'), role: 'cancel' },
    ],
    ...(id ? { id } : {}),
  });
  await t.present();
}

/**
 * Withdraws the toast shown with `id`. `false` when there is none on screen any more (it timed out
 * or was tapped away): Ionic rejects that case, and a notice already gone is not a failure.
 */
export async function dismissToast(id: string): Promise<boolean> {
  return toastController.dismiss(undefined, undefined, id).catch(() => false);
}

export const toastSuccess = (message: string): Promise<void> => toast(message, 'success');
export const toastError = (message: string): Promise<void> => toast(message, 'danger', 4500);
export const toastInfo = (message: string): Promise<void> => toast(message, 'primary');
