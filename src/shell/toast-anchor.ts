// Where the bottom stack of toasts sits: above the bottom bar of the screen on view (the section tabbar of AppPage or
// a view's own `ion-footer`), or above the buttons at the foot of an open dialog, so it never covers them. The top stack
// takes no anchor.
import { computed, onScopeDispose, shallowRef, watch } from 'vue';
import type { ComputedRef, Ref } from 'vue';

import type { Toast } from './toast-store';

/** Not a bar of the screen on view: a page left behind in the stack, a closed overlay, the side
 *  menu, or what Ionic hides from assistive tech while a dialog is open. */
const NOT_ON_VIEW = '.ion-page-hidden, .overlay-hidden, ion-menu, [aria-hidden="true"], [inert]';

const DIALOGS = 'ion-modal, ion-popover, ion-alert, ion-action-sheet, ion-loading';

/** A screen's or a dialog's bottom bar: Ionic's footer, the buttons of a FormModal, and an action sheet, all buttons. */
const BOTTOM_BARS = 'ion-footer, .ep-form-modal__footer, ion-action-sheet .action-sheet-wrapper';

/** How far up the collapsed bottom stack reaches from the foot of the screen: a dialog's bar lower down is under it. */
const STACK_REACH_PX = 100;

/** The bottom bar of the screen on view; `undefined` when the screen has none, and the stack keeps the bottom edge. */
export function toastAnchor(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>(BOTTOM_BARS)].reverse().find((bar) => isOnView(bar) && underStack(bar));
}

/** A page's bar is at its foot; a dialog's, only in a sheet from the bottom, not in a card in the middle of the screen. */
function underStack(bar: HTMLElement): boolean {
  return !bar.closest(DIALOGS) || bar.getBoundingClientRect().bottom > window.innerHeight - STACK_REACH_PX;
}

/** Whether `el` belongs to the screen on view and is painted. */
export function isOnView(el: HTMLElement): boolean {
  return !el.closest(NOT_ON_VIEW) && painted(el);
}

/** Painted: a footer hidden by CSS (immersive mode) measures 0s, and the stack would sit off the screen.
 *  `checkVisibility` where the webview has it (Safari 17.4+), else its boxes. */
function painted(el: HTMLElement): boolean {
  return typeof el.checkVisibility === 'function' ? el.checkVisibility() : el.getClientRects().length > 0;
}

/** A page's dialog to Ionic: opened by its `isOpen`, unless a controller made it. */
type Dialog = HTMLElement & Pick<HTMLIonModalElement, 'isOpen' | 'hasController' | 'onWillDismiss' | 'onDidDismiss'>;

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

/** What Ionic's dialogs say on the page once one is open or gone. */
const DIALOG_EVENTS = ['didPresent', 'didDismiss'];

/**
 * The bar the bottom stack sits above, read again ({@link toastAnchorOnShow}) whenever a toast comes on screen at the
 * bottom edge or a dialog opens or closes over the toasts on screen, and kept while toasts only leave, so the ones on
 * screen do not jump.
 */
export function useToastAnchor(bottom: Readonly<Ref<readonly Toast[]>>): ComputedRef<HTMLElement | undefined> {
  const anchor = shallowRef<HTMLElement | undefined>();
  const read = async (): Promise<void> => {
    anchor.value = await toastAnchorOnShow();
  };
  watch(
    bottom,
    (now, before = []) => {
      if (now.some((toast) => !before.includes(toast))) void read();
    },
    { immediate: true },
  );
  const onDialog = (): void => {
    if (bottom.value.length) void read();
  };
  for (const name of DIALOG_EVENTS) document.addEventListener(name, onDialog);
  onScopeDispose(() => {
    for (const name of DIALOG_EVENTS) document.removeEventListener(name, onDialog);
  });
  return computed(() => anchor.value);
}
