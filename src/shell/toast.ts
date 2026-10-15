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

/** Not a bar of the screen on view: a page left behind in the stack, a closed overlay, the side
 *  menu, or what Ionic hides from assistive tech while a dialog is open. */
const NOT_ON_VIEW = '.ion-page-hidden, .overlay-hidden, ion-menu, [aria-hidden="true"], [inert]';

/**
 * What a toast sits above (S-04, UX audit 2): the bottom bar of the screen on view — the section
 * tabbar of AppPage or a view's own `ion-footer` — so it never covers it. `undefined` when the
 * screen has none: the toast keeps the bottom edge.
 */
export function toastAnchor(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('ion-footer')]
    .reverse()
    .find((footer) => !footer.closest(NOT_ON_VIEW) && painted(footer));
}

/** Painted: a footer hidden by CSS (immersive mode) measures 0s, and Ionic would place the toast
 *  off the screen. `checkVisibility` where the webview has it (Safari 17.4+), else its boxes. */
function painted(el: HTMLElement): boolean {
  return typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.getClientRects().length > 0;
}

/**
 * Shows a global toast, above the bottom bar of the screen when it has one ({@link toastAnchor}).
 * `duration` in ms (0 = sticky, closed by its button, labelled in the language of the page:
 * `toast.close` of the shell catalogue). `id` names it so
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
  const anchor = toastAnchor();
  const t = await toastController.create({
    message,
    color,
    duration,
    position: 'bottom',
    ...(anchor ? { positionAnchor: anchor } : {}),
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
