// Where the bottom stack of toasts sits: above the bottom bar of the screen on view (the section tabbar of AppPage or
// a view's own `ion-footer`), so it never covers it. The top stack takes no anchor.
import { computed, shallowRef, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { Toast } from './toast-store';

/** Not a bar of the screen on view: a page left behind in the stack, a closed overlay, the side
 *  menu, or what Ionic hides from assistive tech while a dialog is open. */
const NOT_ON_VIEW = '.ion-page-hidden, .overlay-hidden, ion-menu, [aria-hidden="true"], [inert]';

/** The bottom bar of the screen on view; `undefined` when the screen has none, and the stack keeps the bottom edge. */
export function toastAnchor(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('ion-footer')]
    .reverse()
    .find((footer) => !footer.closest(NOT_ON_VIEW) && painted(footer));
}

/** Painted: a footer hidden by CSS (immersive mode) measures 0s, and the stack would sit off the screen.
 *  `checkVisibility` where the webview has it (Safari 17.4+), else its boxes. */
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
export async function toastAnchorOnShow(): Promise<HTMLElement | undefined> {
  await new Promise((frame) => requestAnimationFrame(frame));
  await Promise.all(closingDialogs().map(pageBackFrom));
  return toastAnchor();
}

/**
 * The bar the bottom stack sits above, read again ({@link toastAnchorOnShow}) whenever a toast comes on screen at the
 * bottom edge, and kept while toasts only leave, so the ones on screen do not jump.
 */
export function useToastAnchor(bottom: Readonly<Ref<readonly Toast[]>>): ComputedRef<HTMLElement | undefined> {
  const anchor = shallowRef<HTMLElement | undefined>();
  watch(
    bottom,
    async (now, before = []) => {
      if (!now.some((toast) => !before.includes(toast))) return;
      anchor.value = await toastAnchorOnShow();
    },
    { immediate: true },
  );
  return computed(() => anchor.value);
}
