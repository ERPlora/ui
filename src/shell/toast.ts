// Global action feedback through Ionic's imperative `toastController`, so no template carries its own
// `<ion-toast>`. One notice at a time, like Material's snackbar: Ionic paints every toast at the same
// place, so a new one closes the one on screen first and two never cover each other.
import { toastController } from '@ionic/vue';

import { shellText } from './i18n';

export type ToastColor = 'success' | 'danger' | 'medium' | 'primary' | 'warning';

/** A button that does something, shown before the close button (e.g. «Retry»). */
export interface ToastAction {
  text: string;
  handler: () => void;
}

/** Not a bar of the screen on view: a page left behind in the stack, a closed overlay, the side
 *  menu, or what Ionic hides from assistive tech while a dialog is open. */
const NOT_ON_VIEW = '.ion-page-hidden, .overlay-hidden, ion-menu, [aria-hidden="true"], [inert]';

/**
 * What a toast sits above: the bottom bar of the screen on view — the section
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

/** A page's dialog to Ionic: opened by its `isOpen`, unless a controller made it. */
type Dialog = HTMLElement & Pick<HTMLIonModalElement, 'isOpen' | 'hasController' | 'onWillDismiss' | 'onDidDismiss'>;

const DIALOGS = 'ion-modal, ion-popover, ion-alert, ion-action-sheet, ion-loading';

/** The longest a toast waits for a dialog set to close to give the page back: one that never lets go (a `canDismiss`
 *  that says no) does not keep the notice, which then shows where it can. */
const CLOSING_DIALOG_WAIT_MS = 2000;

/** The page's dialogs set to close (`isOpen` false) that are still on screen: about to close, or closing. */
function closingDialogs(): Dialog[] {
  return [...document.querySelectorAll<Dialog>(DIALOGS)].filter(
    (dialog) => !dialog.hasController && !dialog.isOpen && !dialog.classList.contains('overlay-hidden'),
  );
}

/** Once `dialog` has given the page back: when it starts to close (its `willDismiss`, Ionic drops the outlet's
 *  `aria-hidden` just before), or when it is gone if it was already closing. */
function pageBackFrom(dialog: Dialog): Promise<void> {
  return new Promise((back) => {
    const done = (): void => {
      clearTimeout(timer);
      back();
    };
    const timer = setTimeout(done, CLOSING_DIALOG_WAIT_MS);
    void dialog.onWillDismiss().then(done);
    void dialog.onDidDismiss().then(done);
  });
}

/**
 * The bar of the screen the toast shows on, not of the one there when it is asked. A notice is often asked
 * in the same breath as what changes the screen — a dialog set to close, a page just pushed —, so it is read once that
 * has run (the next frame) and, when a dialog is closing, once the dialog has given the page back: Ionic lets a dialog
 * go only when its own lock is free (~300 ms after `open = false` back from a payment), and until then the page and its
 * bar stay hidden behind it.
 */
async function anchorOnShow(): Promise<HTMLElement | undefined> {
  await new Promise((frame) => requestAnimationFrame(frame));
  await Promise.all(closingDialogs().map(pageBackFrom));
  return toastAnchor();
}

/** The toast on screen, and which call asked for it: a call answered late never covers a newer notice. */
let onScreen: { toast: HTMLIonToastElement; order: number } | undefined;
let asked = 0;

/**
 * Shows a global toast, above the bottom bar of the screen it shows on when it has one ({@link toastAnchor}, read when
 * it shows, after a dialog set to close has given the page back: {@link anchorOnShow}).
 * `duration` in ms (0 = sticky, closed by its button, labelled in the language of the page:
 * `toast.close` of the shell catalogue). `id` names it so
 * {@link dismissToast} can withdraw it once what it says stops being true. `action` adds a button
 * that runs its handler (and closes the toast). `position: 'top'` is for a notice that shares the screen with a
 * sheet's keys at the bottom edge; it takes no anchor, because Ionic would set it under the bottom bar.
 * The toast on screen, if any, is closed first (one at a time).
 */
export async function toast(
  message: string,
  color: ToastColor = 'medium',
  duration = 2600,
  id?: string,
  action?: ToastAction,
  position: 'bottom' | 'top' = 'bottom',
): Promise<void> {
  const order = ++asked;
  const anchor = position === 'bottom' ? await anchorOnShow() : undefined;
  const t = await toastController.create({
    message,
    color,
    duration,
    position,
    ...(anchor ? { positionAnchor: anchor } : {}),
    buttons: [
      ...(action ? [{ text: action.text, handler: action.handler }] : []),
      { text: shellText('toast.close'), role: 'cancel' },
    ],
    ...(id ? { id } : {}),
  });
  if (onScreen && onScreen.order > order) return;
  const previous = onScreen?.toast;
  onScreen = { toast: t, order };
  void t.onDidDismiss().then(() => {
    if (onScreen?.toast === t) onScreen = undefined;
  });
  if (previous) await previous.dismiss().catch(() => false);
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
