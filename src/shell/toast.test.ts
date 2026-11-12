import { beforeEach, describe, expect, it, vi } from 'vitest';

const { present, create, dismiss } = vi.hoisted(() => {
  const present = vi.fn();
  // Each toast its own element: `present`, `dismiss` (it resolves its `onDidDismiss`) and `onDidDismiss`.
  const create = vi.fn(async (options: { message: string }) => {
    let closed: (value: unknown) => void = () => {};
    const gone = new Promise((resolve) => (closed = resolve));
    return {
      message: options.message,
      present,
      dismiss: vi.fn(async () => {
        closed({});
        return true;
      }),
      onDidDismiss: () => gone,
    };
  });
  return { present, create, dismiss: vi.fn() };
});
vi.mock('@ionic/vue', () => ({ toastController: { create, dismiss } }));

import * as toastModule from './toast';
import { dismissToast, toast, toastAnchor, toastError, toastInfo, toastSuccess } from './toast';

beforeEach(() => {
  document.body.replaceChildren();
  document.documentElement.lang = 'en';
  create.mockClear();
  present.mockClear();
  dismiss.mockReset();
});

describe('toast', () => {
  it('toastSuccess: success color, 2600 ms, bottom, an OK close button', async () => {
    await toastSuccess('Saved');
    expect(create).toHaveBeenCalledWith({
      message: 'Saved',
      color: 'success',
      duration: 2600,
      position: 'bottom',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    expect(present).toHaveBeenCalledTimes(1);
  });

  it('toastError: danger color and a longer 4500 ms', async () => {
    await toastError('Boom');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ color: 'danger', duration: 4500, message: 'Boom' }));
  });

  it('toastInfo: primary color', async () => {
    await toastInfo('FYI');
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ color: 'primary', duration: 2600 }));
  });

  it('adds an id and an action button before the close button', async () => {
    const handler = vi.fn();
    await toast('Retry?', 'warning', 0, 'retry-id', { text: 'Retry', handler });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'retry-id',
        duration: 0,
        buttons: [{ text: 'Retry', handler }, { text: 'OK', role: 'cancel' }],
      }),
    );
  });

  // The close button is the shell's text, in the language of the page: `<html lang>`, which
  // createShell keeps in step with the person's language (`base.session.me.language`).
  it('the close button speaks the language of the page (shell catalogue, en + es)', async () => {
    document.documentElement.lang = 'es';
    await toastSuccess('Guardado');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ buttons: [{ text: 'Aceptar', role: 'cancel' }] }));
    const handler = vi.fn();
    await toast('¿Reintentar?', 'warning', 0, undefined, { text: 'Reintentar', handler });
    expect(create).toHaveBeenLastCalledWith(
      expect.objectContaining({ buttons: [{ text: 'Reintentar', handler }, { text: 'Aceptar', role: 'cancel' }] }),
    );
    document.documentElement.lang = 'fr';
    await toastInfo('Info');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ buttons: [{ text: 'OK', role: 'cancel' }] }));
  });

  // Two notices in a row never cover each other (Material's snackbar, Ionic's toasts at one position): the new one
  // closes the one on screen first, so only the last is seen, whole.
  it('a new toast closes the one on screen before it shows', async () => {
    await toastError('Could not upload “setup.exe”');
    const first = await create.mock.results.at(-1)!.value;
    await toastSuccess('Files uploaded.');
    const second = await create.mock.results.at(-1)!.value;
    expect(first.dismiss).toHaveBeenCalledTimes(1);
    expect(second.dismiss).not.toHaveBeenCalled();
    expect(first.dismiss.mock.invocationCallOrder[0]).toBeLessThan(present.mock.invocationCallOrder.at(-1)!);
  });

  it('a toast closed by its button or its time is not closed again by the next', async () => {
    await toastSuccess('Saved');
    const first = await create.mock.results.at(-1)!.value;
    await first.dismiss();
    first.dismiss.mockClear();
    await toastSuccess('Saved again');
    expect(first.dismiss).not.toHaveBeenCalled();
  });

  it('a toast whose creation answers after a newer one never covers it', async () => {
    const impl = create.getMockImplementation()!;
    let release: () => void = () => {};
    const late = new Promise<void>((resolve) => (release = resolve));
    create.mockImplementationOnce(async (options) => {
      await late;
      return impl(options);
    });
    const first = toastError('Older');
    await toastSuccess('Newer');
    present.mockClear();
    release();
    await first;
    // The older one is never shown, and the newer one stays on screen.
    expect(present).not.toHaveBeenCalled();
    const [older, newer] = await Promise.all(create.mock.results.slice(-2).map((result) => result.value));
    expect([older.message, newer.message]).toEqual(['Older', 'Newer']);
    expect(newer.dismiss).not.toHaveBeenCalled();
  });

  it('dismissToast returns false instead of throwing when the toast is gone', async () => {
    dismiss.mockRejectedValueOnce(new Error('gone'));
    expect(await dismissToast('x')).toBe(false);
    dismiss.mockResolvedValueOnce(true);
    expect(await dismissToast('x')).toBe(true);
    expect(dismiss).toHaveBeenCalledWith(undefined, undefined, 'x');
  });
});

// At 390px a toast at the bottom covers the section tabbar (y=762–834 over a bar from y=786); Ionic's
// `positionAnchor` sets it above the screen's bottom bar instead.
describe('the toast sits above the bottom bar of the screen on view (S-04)', () => {
  /** What Ionic renders: the menu, the stack of pages (hidden ones marked) and a page's footer. */
  function shell(pages: string): void {
    document.body.innerHTML = `
      <ion-app>
        <ion-menu><ion-content></ion-content><ion-footer class="sidebar-foot" data-id="menu"></ion-footer></ion-menu>
        <ion-router-outlet id="main">${pages}</ion-router-outlet>
      </ion-app>`;
  }
  const byId = (id: string) => document.querySelector(`[data-id="${id}"]`);

  it('anchors to the footer tabbar of the page on view', async () => {
    shell(`<div class="ion-page"><ion-header></ion-header><ion-content></ion-content>
      <ion-footer class="section-tabbar" data-id="tabbar"></ion-footer></div>`);
    await toastError('Could not download');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ position: 'bottom', positionAnchor: byId('tabbar') }));
    await toastSuccess('Saved');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ positionAnchor: byId('tabbar') }));
  });

  it('never to the footer of a page left behind in the stack, nor to the side menu', () => {
    shell(`<div class="ion-page ion-page-hidden" aria-hidden="true"><ion-footer data-id="old"></ion-footer></div>
      <div class="ion-page"><ion-content></ion-content><ion-footer data-id="current"></ion-footer></div>`);
    expect(toastAnchor()).toBe(byId('current'));
    shell(`<div class="ion-page ion-page-hidden"><ion-footer data-id="old"></ion-footer></div><div class="ion-page"></div>`);
    expect(toastAnchor()).toBeUndefined();
  });

  it('not to a page behind an open dialog (Ionic hides it from assistive tech)', () => {
    shell(`<div class="ion-page"><ion-footer data-id="tabbar"></ion-footer></div>`);
    document.querySelector('ion-router-outlet')!.setAttribute('aria-hidden', 'true');
    expect(toastAnchor()).toBeUndefined();
  });

  it('not to a bar the screen does not paint (immersive mode hides the footer): Ionic would measure 0s', () => {
    shell(`<div class="ion-page"><ion-footer data-id="tabbar" style="display: none"></ion-footer></div>`);
    expect(toastAnchor()).toBeUndefined();
  });

  // Back from a payment, `open = false` and the notice come in one go, while the dialog is still open. Ionic
  // gives the page back (drops the outlet's `aria-hidden`) once the dialog starts to close, a few promises later, and
  // the page the flow went to is there by then: the bar is the one on view when the notice shows, not when it is asked.
  it('asked as a dialog closes, it sits above the bar of the page the dialog leaves on view', async () => {
    shell(`<div class="ion-page"><ion-content></ion-content><ion-footer data-id="tabbar"></ion-footer></div>`);
    const outlet = document.querySelector('ion-router-outlet')!;
    outlet.setAttribute('aria-hidden', 'true');
    const shown = toastSuccess('Café Central is now on Starter');
    await Promise.resolve();
    outlet.removeAttribute('aria-hidden');
    await shown;
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ position: 'bottom', positionAnchor: byId('tabbar') }));
  });

  it('asked as the next page comes, it sits above the bar of that page, not of the one it leaves', async () => {
    shell(`<div class="ion-page"><ion-content></ion-content></div>`);
    const shown = toastSuccess('Saved');
    await Promise.resolve();
    document.querySelector('ion-router-outlet')!.insertAdjacentHTML(
      'beforeend',
      `<div class="ion-page"><ion-content></ion-content><ion-footer data-id="next"></ion-footer></div>`,
    );
    await shown;
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ positionAnchor: byId('next') }));
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

  // In Chrome, back from a payment the dialog is set to close (`isOpen` false at Vue's next flush) and the
  // notice asked in one go, but Ionic lets the dialog go only once its own lock is free, ~300 ms later; till then the
  // page stays hidden behind it. The notice waits for the dialog to give the page back, and sits above the page's bar.
  it('asked as its dialog is set to close, it waits for the dialog to give the page back', async () => {
    shell(`<div class="ion-page"><ion-content></ion-content><ion-footer data-id="tabbar"></ion-footer></div>`);
    const { dialog, letGo } = openDialog();
    const shown = toastSuccess('Café Central is now on Starter');
    await Promise.resolve();
    dialog.isOpen = false;
    await new Promise((later) => setTimeout(later, 60));
    expect(create).not.toHaveBeenCalled();
    letGo();
    await shown;
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ position: 'bottom', positionAnchor: byId('tabbar') }));
  });

  it('over a dialog that stays open it shows at once, with nothing of the page hidden behind it to sit above', async () => {
    shell(`<div class="ion-page"><ion-content></ion-content><ion-footer data-id="tabbar"></ion-footer></div>`);
    openDialog();
    await toastError('Could not save');
    expect(create).toHaveBeenLastCalledWith(expect.not.objectContaining({ positionAnchor: expect.anything() }));
  });

  it('a dialog set to close that never lets go does not keep the notice: it shows after 2 s, at the bottom edge', async () => {
    vi.useFakeTimers();
    try {
      shell(`<div class="ion-page"><ion-content></ion-content><ion-footer data-id="tabbar"></ion-footer></div>`);
      const { dialog } = openDialog();
      dialog.isOpen = false;
      const shown = toastSuccess('Saved');
      await vi.advanceTimersByTimeAsync(1900);
      expect(create).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(200);
      await shown;
      expect(create).toHaveBeenLastCalledWith(expect.not.objectContaining({ positionAnchor: expect.anything() }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('without a bottom bar it stays at the bottom edge, with no anchor', async () => {
    shell(`<div class="ion-page"><ion-content></ion-content></div>`);
    await toastInfo('FYI');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ position: 'bottom' }));
    expect(create).toHaveBeenLastCalledWith(expect.not.objectContaining({ positionAnchor: expect.anything() }));
  });
});

// A notice that shares the screen with a sheet's keys at the bottom edge is asked for at the top, so a tap on
// the last row of keys does not fall on it.
describe('a toast asked for at the top', () => {
  const pageWithBar = `<ion-app><ion-router-outlet><div class="ion-page"><ion-footer data-id="bar"></ion-footer></div></ion-router-outlet></ion-app>`;

  it('sits at the top edge, with no anchor: Ionic would put it under the bottom bar on view', async () => {
    document.body.innerHTML = pageWithBar;
    await toast('Sent', 'success', 2600);
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ position: 'bottom', positionAnchor: document.querySelector('[data-id="bar"]') }));

    await toast('Sent', 'success', 2600, undefined, undefined, 'top');
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ message: 'Sent', color: 'success', duration: 2600, position: 'top' }));
    expect(create).toHaveBeenLastCalledWith(expect.not.objectContaining({ positionAnchor: expect.anything() }));
  });

  it('closes the toast on screen first, wherever it sat: one notice at a time', async () => {
    await toast('At the bottom');
    const first = await create.mock.results.at(-1)!.value;
    await toast('At the top', 'success', 2600, undefined, undefined, 'top');
    expect(first.dismiss).toHaveBeenCalledTimes(1);
    expect(present).toHaveBeenCalledTimes(2);
  });
});

describe('no global CSV feedback', () => {
  it('exports no window-event hook for csvExport/csvImport', () => {
    expect(toastModule).not.toHaveProperty('bootActionFeedback');
  });
});
