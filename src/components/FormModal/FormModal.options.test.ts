import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';

import {
  accessibleName,
  byTestId,
  cancelButton,
  click,
  closeButton,
  key,
  modal,
  modalEl,
  mounted,
  mountModal,
  reallyFocused,
  settle,
  submitButton,
  unmountModals,
  type Props,
} from './__tests__/form-modal';

vi.mock('@ionic/vue', async (importOriginal) => (await import('./__tests__/ionModalStub')).ionicVueWithModalStub(importOriginal));

afterEach(unmountModals);

describe('FormModal: options', () => {
  it('labels: its own en/es defaults, or the page\'s', async () => {
    const es = mountModal({}, {}, 'es');
    await settle();
    expect(cancelButton(es).textContent?.trim()).toBe('Cancelar');
    expect(submitButton(es).textContent?.trim()).toBe('Guardar');
    expect(accessibleName(closeButton(es))).toBe('Cerrar');
    es.unmount();
    mounted.splice(0);
    const own = mountModal({ submitLabel: 'Send invitation', cancelLabel: 'Back' });
    await settle();
    expect(submitButton(own).textContent?.trim()).toBe('Send invitation');
    expect(cancelButton(own).textContent?.trim()).toBe('Back');
  });

  it('size: md by default (the 480px dialog), sm for short confirmations', async () => {
    const md = mountModal();
    await settle();
    expect(modalEl(md).getAttribute('data-size')).toBe('md');
    const sm = mountModal({ size: 'sm' });
    await settle();
    expect(modalEl(sm).getAttribute('data-size')).toBe('sm');
  });

  it('Save takes an Ionic colour and an icon', async () => {
    const wrapper = mountModal({ submitColor: 'danger', submitIcon: 'ion:trash-outline' });
    await settle();
    expect((submitButton(wrapper) as HTMLElement & { color?: string }).color).toBe('danger');
    expect(submitButton(wrapper).querySelector('ion-icon')).not.toBeNull();
  });

  it('`role: alertdialog` for consequential confirmations', async () => {
    const wrapper = mountModal({ role: 'alertdialog' });
    await settle();
    expect(modalEl(wrapper).getAttribute('role')).toBe('alertdialog');
  });

  it('the footer slot replaces the buttons and gets submit, cancel and pending', async () => {
    const wrapper = mountModal({}, {
      footer: ({ submit, cancel, pending }) => [
        h('button', { 'data-testid': 'own-submit', onClick: submit }, `Go ${String(pending)}`),
        h('button', { 'data-testid': 'own-cancel', onClick: cancel }, 'Stop'),
      ],
    });
    await settle();
    expect(wrapper.find('.ep-form-modal__submit').exists()).toBe(false);
    expect(byTestId('own-submit')?.textContent).toBe('Go false');
    await click(byTestId('own-submit'));
    expect(wrapper.emitted('submit')).toHaveLength(1);
    await click(byTestId('own-cancel'));
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    // Native buttons are `type="submit"` by default: the form's own submit event must not add a
    // second submit (own-submit) nor turn a cancel into a submit (own-cancel).
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('`testid` hooks the modal, its buttons and its error; nothing without it', async () => {
    const hooked = mountModal({ testid: 'invite', error: { message: 'Nope' } });
    await settle();
    for (const id of ['invite', 'invite-submit', 'invite-cancel', 'invite-close', 'invite-error']) {
      expect(byTestId(id), id).not.toBeNull();
    }
    hooked.unmount();
    mounted.splice(0);
    mountModal({ error: { message: 'Nope' } });
    await settle();
    expect(document.querySelectorAll('[data-testid]').length).toBe(1); // only the slot's own field
  });
});

// A window that holds what the person typed asks before ANY way out throws it away — Cancel, the close button, Escape, a
// tap on the backdrop and the system Back (Ionic's own dismissal, role `backdrop`) — and stays while the answer is
// «no». The page gives the question (`canDismiss`); closing from the page (`open = false`, a saved form) never asks.
describe('FormModal: asks before the person closes it (`canDismiss`)', () => {
  /** A page's question, answered `answer` (or by hand when `answer` is a promise it resolves). */
  const asking = (answer: boolean | Promise<boolean>) => vi.fn(() => answer);
  /** A way out: its name, how the person takes it, and the dialog's options for it. */
  type Way = [string, (w: VueWrapper) => Promise<void>, Partial<Props>?];
  const ways: Way[] = [
    ['Cancel', (w) => click(cancelButton(w))],
    ['the close button', (w) => click(closeButton(w))],
    ['Escape', () => key(byTestId('email')!, 'Escape')],
    ['Escape without backdrop dismissal', () => key(byTestId('email')!, 'Escape'), { dismissOnBackdrop: false }],
    ['a tap on the backdrop', async (w) => void (await modal(w).tapBackdrop())],
    ['Ionic’s own dismissal (the system Back)', async (w) => void (await modal(w).dismiss('backdrop'))],
  ];

  /** The person takes `close` on a dialog whose page answers `answer`: it was asked once. */
  async function leave(answer: boolean | Promise<boolean>, close: Way[1], options: Partial<Props> = {}): Promise<VueWrapper> {
    const canDismiss = asking(answer);
    const wrapper = mountModal({ canDismiss, ...options });
    await settle();
    await close(wrapper);
    await settle();
    expect(canDismiss).toHaveBeenCalledTimes(1);
    return wrapper;
  }

  it.each(ways)('%s asks first, and «no» keeps it open: no `cancel`, still open', async (_way, close, options) => {
    const wrapper = await leave(false, close, options);
    expect(wrapper.emitted('cancel')).toBeUndefined();
    expect(wrapper.emitted('update:open')).toBeUndefined();
    expect(byTestId('email')).not.toBeNull();
  });

  it.each(ways)('%s asks first, and «yes» closes it: one `cancel`, open → false, asked once', async (_way, close, options) => {
    const wrapper = await leave(Promise.resolve(true), close, options);
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    expect(byTestId('email')).toBeNull();
  });

  it('a page that answers at once (`true`, not a promise) closes it the same', async () => {
    const wrapper = mountModal({ canDismiss: () => true });
    await settle();
    await click(cancelButton(wrapper));
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('it stays open while the question is up, and a second Cancel or × asks nothing more', async () => {
    let answer!: (value: boolean) => void;
    const canDismiss = asking(new Promise<boolean>((resolve) => (answer = resolve)));
    const wrapper = mountModal({ canDismiss });
    await settle();
    await click(cancelButton(wrapper));
    await click(closeButton(wrapper));
    expect(canDismiss).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('update:open')).toBeUndefined();
    answer(true);
    await settle();
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('asked again on the next way out after a «no»', async () => {
    const canDismiss = vi.fn<() => boolean>().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const wrapper = mountModal({ canDismiss });
    await settle();
    await click(cancelButton(wrapper));
    expect(wrapper.emitted('update:open')).toBeUndefined();
    await key(byTestId('email')!, 'Escape');
    expect(canDismiss).toHaveBeenCalledTimes(2);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('closing from the page (open → false, a saved form) never asks', async () => {
    const canDismiss = asking(false);
    const wrapper = mountModal({ canDismiss });
    await settle();
    await click(submitButton(wrapper));
    await wrapper.setProps({ open: false });
    await settle();
    expect(canDismiss).not.toHaveBeenCalled();
    expect(byTestId('email')).toBeNull();
    expect(wrapper.emitted('cancel')).toBeUndefined();
  });

  it('a dismissal by who already asked (role `handler`) is not asked again', async () => {
    const canDismiss = asking(false);
    const wrapper = mountModal({ canDismiss });
    await settle();
    expect(modal(wrapper).dismiss('handler')).toBe(true);
    await settle();
    expect(canDismiss).not.toHaveBeenCalled();
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });

  it('nothing asks while a submit is pending: nothing closes it', async () => {
    const canDismiss = asking(true);
    const wrapper = mountModal({ canDismiss, pending: true });
    await settle();
    await click(cancelButton(wrapper));
    await click(closeButton(wrapper));
    await key(byTestId('email')!, 'Escape');
    expect(canDismiss).not.toHaveBeenCalled();
    expect(wrapper.emitted('update:open')).toBeUndefined();
  });

  it('a question that could not be asked keeps it open and says why in the console', async () => {
    const failure = new Error('no dialog');
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      for (const close of [(w: VueWrapper) => click(cancelButton(w)), async (w: VueWrapper) => void (await modal(w).tapBackdrop())]) {
        const wrapper = mountModal({ canDismiss: () => Promise.reject(failure) });
        await settle();
        await close(wrapper);
        await settle();
        expect(wrapper.emitted('update:open')).toBeUndefined();
        expect(byTestId('email')).not.toBeNull();
        wrapper.unmount();
        mounted.splice(0);
      }
      expect(logged).toHaveBeenCalledTimes(2);
      expect(logged).toHaveBeenCalledWith('ui: could not ask whether to close the dialog', failure);
    } finally {
      logged.mockRestore();
    }
  });

  it('without `canDismiss` nothing changes: Ionic dismisses it at once', async () => {
    const wrapper = mountModal();
    await settle();
    expect(modal(wrapper).tapBackdrop()).toBe(true);
    await settle();
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});

describe('FormModal: read only (a window that only shows data, ui#62)', () => {
  // Odoo, Shopify and Business Central: the header's close and ONE «Close» at the foot; never
  // Cancel and Close side by side, which do the same, and nothing to save.
  const doneButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__done').element as HTMLElement;

  it('its footer is a single «Close» (Cerrar in Spanish): no Save, no Cancel', async () => {
    for (const [locale, text] of [['en', 'Close'], ['es', 'Cerrar']] as const) {
      const wrapper = mountModal({ readonly: true }, {}, locale);
      await settle();
      const footer = wrapper.get('.ep-form-modal__footer');
      expect(footer.findAll('ion-button')).toHaveLength(1);
      expect(wrapper.find('.ep-form-modal__submit').exists()).toBe(false);
      expect(wrapper.find('.ep-form-modal__cancel').exists()).toBe(false);
      expect(doneButton(wrapper).textContent?.trim()).toBe(text);
      wrapper.unmount();
      mounted.splice(0);
    }
  });

  it('its «Close» closes it as the header\'s does (`cancel`, open → false), never a submit', async () => {
    const wrapper = mountModal({ readonly: true });
    await settle();
    await click(doneButton(wrapper));
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('Enter in a field submits nothing: there is nothing to save', async () => {
    const wrapper = mountModal({ readonly: true });
    await settle();
    await key(byTestId('email')!, 'Enter');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('with no field, its «Close» takes the focus on its native button, so Enter closes it (ui#73)', async () => {
    const wrapper = mountModal({ readonly: true }, { default: () => [h('p', 'Three sale lines in no shift')] });
    await settle();
    expect(reallyFocused(doneButton(wrapper))).toBe(true);
  });

  it('`testid` hooks its «Close» as `<testid>-done`', async () => {
    mountModal({ readonly: true, testid: 'unassigned' });
    await settle();
    expect(byTestId('unassigned-done')).not.toBeNull();
    expect(byTestId('unassigned-cancel')).toBeNull();
    expect(byTestId('unassigned-submit')).toBeNull();
  });

  it('the footer slot still replaces the buttons', async () => {
    const wrapper = mountModal({ readonly: true }, { footer: () => [h('button', { class: 'own' }, 'Print')] });
    await settle();
    expect(wrapper.find('.own').exists()).toBe(true);
    expect(wrapper.find('.ep-form-modal__done').exists()).toBe(false);
  });
});

describe('FormModal: on a phone', () => {
  it('is a sheet by default and a centred card with `phoneLayout: card`, said on the ion-modal for the stylesheet', async () => {
    const sheet = mountModal();
    await settle();
    expect(modalEl(sheet).getAttribute('data-phone-layout')).toBe('sheet');
    const card = mountModal({ phoneLayout: 'card' });
    await settle();
    expect(modalEl(card).getAttribute('data-phone-layout')).toBe('card');
  });
});
