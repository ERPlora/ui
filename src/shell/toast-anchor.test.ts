import { effectScope, shallowRef } from 'vue';
import type { EffectScope, Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { toastAnchor, toastAnchorOnShow, useToastAnchor } from './toast-anchor';
import type { Toast } from './toast-store';

/** What Ionic renders: the menu, the stack of pages (hidden ones marked) and a page's footer. */
function shell(pages: string): void {
  document.body.innerHTML = `
    <ion-app>
      <ion-menu><ion-content></ion-content><ion-footer class="sidebar-foot" data-id="menu"></ion-footer></ion-menu>
      <ion-router-outlet id="main">${pages}</ion-router-outlet>
    </ion-app>`;
}
const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);
const pageWithBar = (id: string) => `<div class="ion-page"><ion-content></ion-content><ion-footer data-id="${id}"></ion-footer></div>`;

/** Whether `promise` has settled yet. */
function watchSettled(promise: Promise<unknown>): () => boolean {
  let settled = false;
  void promise.then(() => (settled = true));
  return () => settled;
}

beforeEach(() => {
  document.body.replaceChildren();
});

// At 390px a toast at the bottom covers the section tabbar (y=762–834 over a bar from y=786): the bottom stack sits
// above the screen's bottom bar instead.
describe('the bar a toast sits above: the bottom bar of the screen on view', () => {
  it('the footer tabbar of the page on view', () => {
    shell(`<div class="ion-page"><ion-header></ion-header><ion-content></ion-content>
      <ion-footer class="section-tabbar" data-id="tabbar"></ion-footer></div>`);
    expect(toastAnchor()).toBe(byId('tabbar'));
  });

  it('never the footer of a page left behind in the stack, nor of the side menu', () => {
    shell(`<div class="ion-page ion-page-hidden" aria-hidden="true"><ion-footer data-id="old"></ion-footer></div>
      <div class="ion-page"><ion-content></ion-content><ion-footer data-id="current"></ion-footer></div>`);
    expect(toastAnchor()).toBe(byId('current'));
    shell(`<div class="ion-page ion-page-hidden"><ion-footer data-id="old"></ion-footer></div><div class="ion-page"></div>`);
    expect(toastAnchor()).toBeUndefined();
  });

  it('not of a page behind an open dialog (Ionic hides it from assistive tech)', () => {
    shell(pageWithBar('tabbar'));
    document.querySelector('ion-router-outlet')!.setAttribute('aria-hidden', 'true');
    expect(toastAnchor()).toBeUndefined();
  });

  it('not a bar the screen does not paint (immersive mode hides the footer): it would measure 0s', () => {
    shell(`<div class="ion-page"><ion-footer data-id="tabbar" style="display: none"></ion-footer></div>`);
    expect(toastAnchor()).toBeUndefined();
  });

  it('none without a bottom bar: the stack keeps the bottom edge', () => {
    shell(`<div class="ion-page"><ion-content></ion-content></div>`);
    expect(toastAnchor()).toBeUndefined();
  });
});

// At 390 px a form opens as a sheet from the bottom, and a toast at the bottom edge covered its Cancel and Save
// (y=772–828 over buttons from y=775). Like Material's snackbar anchored to a bottom bar, the stack sits above the
// buttons at the foot of an open dialog, when they are at the foot of the screen.
describe('the bar a toast sits above while a dialog is open: the foot of the dialog, at the foot of the screen', () => {
  /** An open dialog of Ionic over the page (the outlet hidden), with `inner` in it and `bar` at `top`–`bottom`. */
  function dialogWith(tag: string, inner: string, rect: { top: number; bottom: number }): HTMLElement {
    shell(pageWithBar('tabbar'));
    document.querySelector('ion-router-outlet')!.setAttribute('aria-hidden', 'true');
    const dialog = document.createElement(tag);
    dialog.innerHTML = inner;
    document.querySelector('ion-app')!.append(dialog);
    const bar = dialog.querySelector<HTMLElement>('[data-id="bar"]')!;
    bar.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: rect.top, width: 390, height: rect.bottom - rect.top });
    return bar;
  }
  const atTheFoot = { top: window.innerHeight - 69, bottom: window.innerHeight };
  const inTheMiddle = { top: window.innerHeight / 2, bottom: window.innerHeight / 2 + 60 };

  it('the row of buttons of a form sheet', () => {
    const bar = dialogWith('ion-modal', `<form><div class="ep-form-modal__footer" data-id="bar"></div></form>`, atTheFoot);
    expect(toastAnchor()).toBe(bar);
  });

  it('the footer of a dialog', () => {
    const bar = dialogWith('ion-modal', `<ion-content></ion-content><ion-footer data-id="bar"></ion-footer>`, atTheFoot);
    expect(toastAnchor()).toBe(bar);
  });

  it('the whole of an action sheet, which is all buttons', () => {
    const bar = dialogWith('ion-action-sheet', `<div class="action-sheet-wrapper" data-id="bar"></div>`, atTheFoot);
    expect(toastAnchor()).toBe(bar);
  });

  it('not the foot of a dialog in the middle of the screen (a centred card): the stack keeps the bottom edge', () => {
    dialogWith('ion-modal', `<div class="ep-form-modal__footer" data-id="bar"></div>`, inTheMiddle);
    expect(toastAnchor()).toBeUndefined();
    dialogWith('ion-modal', `<ion-footer data-id="bar"></ion-footer>`, inTheMiddle);
    expect(toastAnchor()).toBeUndefined();
  });
});

// A notice is often asked in the same breath as what changes the screen, so its bar is the one on view once that has
// run, not the one there when it is asked.
describe('the bar once the screen the toast shows on has settled', () => {
  // Back from a payment, `open = false` and the notice come in one go, while the dialog is still open. Ionic gives the
  // page back (drops the outlet's `aria-hidden`) once the dialog starts to close, a few promises later.
  it('asked as a dialog closes, the bar of the page the dialog leaves on view', async () => {
    shell(pageWithBar('tabbar'));
    const outlet = document.querySelector('ion-router-outlet')!;
    outlet.setAttribute('aria-hidden', 'true');
    const anchor = toastAnchorOnShow();
    await Promise.resolve();
    outlet.removeAttribute('aria-hidden');
    expect(await anchor).toBe(byId('tabbar'));
  });

  it('asked as the next page comes, the bar of that page, not of the one it leaves', async () => {
    shell(`<div class="ion-page"><ion-content></ion-content></div>`);
    const anchor = toastAnchorOnShow();
    await Promise.resolve();
    document.querySelector('ion-router-outlet')!.insertAdjacentHTML('beforeend', pageWithBar('next'));
    expect(await anchor).toBe(byId('next'));
  });

  /**
   * A page's dialog as Ionic leaves it on screen, over the page it hides (`aria-hidden` on the outlet): inline (opened
   * by `isOpen`, no controller). `letGo` is what Ionic does once the dialog starts to close: it gives the page back and
   * says `willDismiss`.
   */
  function openDialog(): { dialog: HTMLElement & { isOpen: boolean }; letGo: () => void } {
    const outlet = document.querySelector('ion-router-outlet')!;
    outlet.setAttribute('aria-hidden', 'true');
    let willDismiss: (detail: unknown) => void = () => {};
    const dialog = Object.assign(document.createElement('ion-modal'), {
      isOpen: true,
      hasController: false,
      onWillDismiss: () => new Promise((resolve) => (willDismiss = resolve)),
      onDidDismiss: () => new Promise(() => {}),
    });
    document.querySelector('ion-app')!.append(dialog);
    return {
      dialog,
      letGo: () => {
        outlet.removeAttribute('aria-hidden');
        willDismiss({});
      },
    };
  }

  // In Chrome, back from a payment the dialog is set to close (`isOpen` false at Vue's next flush) and the notice asked
  // in one go, but Ionic lets the dialog go only once its own lock is free, ~300 ms later; till then the page stays
  // hidden behind it.
  it('asked as its dialog is set to close, it waits for the dialog to give the page back', async () => {
    shell(pageWithBar('tabbar'));
    const { dialog, letGo } = openDialog();
    const anchor = toastAnchorOnShow();
    const settled = watchSettled(anchor);
    await Promise.resolve();
    dialog.isOpen = false;
    await new Promise((later) => setTimeout(later, 60));
    expect(settled()).toBe(false);
    letGo();
    expect(await anchor).toBe(byId('tabbar'));
  });

  it('over a dialog that stays open, at once, with nothing of the page hidden behind it to sit above', async () => {
    shell(pageWithBar('tabbar'));
    openDialog();
    expect(await toastAnchorOnShow()).toBeUndefined();
  });

  it('a dialog set to close that never lets go does not keep the notice: after 2 s, the bottom edge', async () => {
    vi.useFakeTimers();
    try {
      shell(pageWithBar('tabbar'));
      const { dialog } = openDialog();
      dialog.isOpen = false;
      const anchor = toastAnchorOnShow();
      const settled = watchSettled(anchor);
      await vi.advanceTimersByTimeAsync(1900);
      expect(settled()).toBe(false);
      await vi.advanceTimersByTimeAsync(200);
      expect(await anchor).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useToastAnchor', () => {
  let scope: EffectScope;
  const toastOf = (id: string): Toast => ({ id, message: id, tone: 'info', duration: 0, position: 'bottom' });

  afterEach(() => scope.stop());

  function anchorFor(bottom: Ref<readonly Toast[]>) {
    scope = effectScope();
    return scope.run(() => useToastAnchor(bottom))!;
  }

  it('reads the bar each time a toast comes to the bottom edge, and keeps it while toasts only leave', async () => {
    shell(pageWithBar('first'));
    const bottom = shallowRef<readonly Toast[]>([]);
    const anchor = anchorFor(bottom);
    expect(anchor.value).toBeUndefined();

    bottom.value = [toastOf('a')];
    const first = byId('first');
    await vi.waitFor(() => expect(anchor.value).toBe(first));

    shell(pageWithBar('second'));
    bottom.value = [];
    await new Promise((later) => setTimeout(later, 50));
    expect(anchor.value).toBe(first);

    bottom.value = [toastOf('b')];
    await vi.waitFor(() => expect(anchor.value).toBe(byId('second')));
  });

  it('a toast replaced by id is a new notice on screen, and reads the bar again', async () => {
    shell(pageWithBar('first'));
    const bottom = shallowRef<readonly Toast[]>([toastOf('a')]);
    const anchor = anchorFor(bottom);
    await vi.waitFor(() => expect(anchor.value).toBe(byId('first')));
    shell(pageWithBar('second'));
    bottom.value = [{ ...toastOf('a'), message: 'again' }];
    await vi.waitFor(() => expect(anchor.value).toBe(byId('second')));
  });

  it('reads the bar again when a dialog opens or closes over toasts on screen, and not with none', async () => {
    shell(pageWithBar('first'));
    const bottom = shallowRef<readonly Toast[]>([]);
    const anchor = anchorFor(bottom);
    shell(pageWithBar('second'));
    document.body.dispatchEvent(new CustomEvent('didPresent', { bubbles: true }));
    await new Promise((later) => setTimeout(later, 50));
    expect(anchor.value).toBeUndefined();

    bottom.value = [toastOf('a')];
    await vi.waitFor(() => expect(anchor.value).toBe(byId('second')));
    shell(pageWithBar('third'));
    document.body.dispatchEvent(new CustomEvent('didPresent', { bubbles: true }));
    await vi.waitFor(() => expect(anchor.value).toBe(byId('third')));
    shell(pageWithBar('fourth'));
    document.body.dispatchEvent(new CustomEvent('didDismiss', { bubbles: true }));
    await vi.waitFor(() => expect(anchor.value).toBe(byId('fourth')));
  });

  it('stops listening to the dialogs once it is gone', async () => {
    shell(pageWithBar('first'));
    const anchor = anchorFor(shallowRef<readonly Toast[]>([toastOf('a')]));
    const first = byId('first');
    await vi.waitFor(() => expect(anchor.value).toBe(first));
    scope.stop();
    shell(pageWithBar('second'));
    document.body.dispatchEvent(new CustomEvent('didPresent', { bubbles: true }));
    await new Promise((later) => setTimeout(later, 50));
    expect(anchor.value).toBe(first);
  });

  it('the toasts already on the stack when the component mounts are placed too', async () => {
    shell(pageWithBar('tabbar'));
    const anchor = anchorFor(shallowRef<readonly Toast[]>([toastOf('a')]));
    await vi.waitFor(() => expect(anchor.value).toBe(byId('tabbar')));
  });
});
