import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h } from 'vue';

import * as root from '../../index';
import * as components from '../index';
import FormModal from './FormModal.vue';
import * as entry from './index';
import {
  accessibleName,
  byTestId,
  cancelButton,
  click,
  closeButton,
  disabled,
  key,
  modal,
  modalEl,
  mountModal,
  nativeOf,
  reallyFocused,
  settle,
  submitButton,
  unmountModals,
} from './__tests__/form-modal';

vi.mock('@ionic/vue', async (importOriginal) => (await import('./__tests__/ionModalStub')).ionicVueWithModalStub(importOriginal));

afterEach(unmountModals);

describe('FormModal: opening and closing', () => {
  it('closed, the ion-modal is there with nothing inside; open, it shows the title, the fields and the footer', async () => {
    const wrapper = mountModal({ open: false });
    await settle();
    expect(modalEl(wrapper).classList).toContain('ep-form-modal');
    expect(wrapper.find('.ep-form-modal__title').exists()).toBe(false);
    await wrapper.setProps({ open: true });
    await settle();
    expect(wrapper.get('ion-title.ep-form-modal__title').text()).toBe('Invite to Bakery');
    expect(byTestId('email')).not.toBeNull();
    expect(cancelButton(wrapper).textContent?.trim()).toBe('Cancel');
    expect(submitButton(wrapper).textContent?.trim()).toBe('Save');
  });

  it('is named by its title: aria-labelledby → the title, and aria-label (the one Ionic carries into its shadow role="dialog")', async () => {
    const wrapper = mountModal();
    await settle();
    const el = modalEl(wrapper);
    const title = wrapper.get('.ep-form-modal__title').element;
    expect(title.id).not.toBe('');
    expect(el.getAttribute('aria-labelledby')).toBe(title.id);
    expect(el.getAttribute('aria-label')).toBe('Invite to Bakery');
    expect(el.getAttribute('role')).toBe('dialog');
  });

  it('each opening presents a fresh ion-modal, so Ionic (which copies aria-label once, on load) reads the current title', async () => {
    const wrapper = mountModal({ title: 'Change the role of Carlos' });
    await settle();
    const first = modalEl(wrapper);
    await wrapper.setProps({ open: false });
    await settle();
    await wrapper.setProps({ title: 'Change the role of Marta' });
    await wrapper.setProps({ open: true });
    await settle();
    const second = modalEl(wrapper);
    expect(second).not.toBe(first);
    expect(second.getAttribute('aria-label')).toBe('Change the role of Marta');
  });

  it('Cancel and the close button emit `cancel` and close it (v-model:open)', async () => {
    for (const pick of [cancelButton, closeButton]) {
      const wrapper = mountModal();
      await settle();
      await click(pick(wrapper));
      expect(wrapper.emitted('cancel')).toHaveLength(1);
      expect(wrapper.emitted('update:open')).toEqual([[false]]);
      expect(wrapper.emitted('submit')).toBeUndefined();
    }
  });

  it('the close button is labelled for a screen reader (it only shows an icon)', async () => {
    const wrapper = mountModal();
    await settle();
    expect(accessibleName(closeButton(wrapper))).toBe('Close');
  });

  it('Save emits `submit` and does NOT close it: the page closes it when its command succeeds', async () => {
    const wrapper = mountModal();
    await settle();
    await click(submitButton(wrapper));
    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toBeUndefined();
    expect(wrapper.emitted('cancel')).toBeUndefined();
  });

  it('a tap on the backdrop cancels it once (the dismissal Ionic does on its own counts as a cancel)', async () => {
    const wrapper = mountModal();
    await settle();
    expect(modalEl(wrapper).getAttribute('data-backdrop-dismiss')).toBe('true');
    expect(modal(wrapper).tapBackdrop()).toBe(true);
    await settle();
    expect(wrapper.emitted('cancel')).toHaveLength(1);
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });

  it('`dismissOnBackdrop: false` keeps it open on a backdrop tap', async () => {
    const wrapper = mountModal({ dismissOnBackdrop: false });
    await settle();
    expect(modalEl(wrapper).getAttribute('data-backdrop-dismiss')).toBe('false');
    expect(modal(wrapper).tapBackdrop()).toBe(false);
    expect(wrapper.emitted('cancel')).toBeUndefined();
  });

  it('closing from the page (open → false) is not a cancel', async () => {
    const wrapper = mountModal();
    await settle();
    await wrapper.setProps({ open: false });
    await settle();
    expect(wrapper.emitted('cancel')).toBeUndefined();
    expect(wrapper.find('.ep-form-modal__title').exists()).toBe(false);
  });
});

describe('FormModal: keyboard', () => {
  it('Escape cancels it, once, with or without backdrop dismissal', async () => {
    for (const dismissOnBackdrop of [true, false]) {
      const wrapper = mountModal({ dismissOnBackdrop });
      await settle();
      await key(byTestId('email')!, 'Escape');
      expect(wrapper.emitted('cancel'), String(dismissOnBackdrop)).toHaveLength(1);
      expect(wrapper.emitted('update:open'), String(dismissOnBackdrop)).toEqual([[false]]);
    }
  });

  it('Enter in a single-line field submits the form', async () => {
    const wrapper = mountModal();
    await settle();
    await key(byTestId('email')!, 'Enter');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  // A scoped ion-input or ion-searchbar handles its own Enter and the keydown still bubbles to the
  // form: a chooser that opens on Enter, a Combo picking an option, a search box inside a child's
  // popover. Their Enter is theirs, never a submit of the form around them.
  it('Enter a field already handled (defaultPrevented) is not a submit', async () => {
    const own = (event: KeyboardEvent) => {
      if (event.key === 'Enter') event.preventDefault();
    };
    const wrapper = mountModal({}, { default: () => [h('input', { 'data-testid': 'chooser', readonly: true, onKeydown: own }), h('input', { 'data-testid': 'combo', onKeydown: own })] });
    await settle();
    await key(byTestId('chooser')!, 'Enter');
    await key(byTestId('combo')!, 'Enter');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('Enter on a read-only field (a chooser that opens on it) is not a submit', async () => {
    const wrapper = mountModal({}, { default: () => [h('input', { 'data-testid': 'chooser', readonly: true })] });
    await settle();
    await key(byTestId('chooser')!, 'Enter');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('Enter inside a popover or a modal of a field (its own search box) is not the form’s', async () => {
    const wrapper = mountModal({}, {
      default: () => [
        h('ion-popover', {}, [h('input', { 'data-testid': 'in-popover' })]),
        h('ion-modal', {}, [h('input', { 'data-testid': 'in-modal' })]),
        h('input', { 'data-testid': 'email' }),
      ],
    });
    await settle();
    await key(byTestId('in-popover')!, 'Enter');
    await key(byTestId('in-modal')!, 'Enter');
    expect(wrapper.emitted('submit')).toBeUndefined();
    await key(byTestId('email')!, 'Enter');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('Enter in a textarea is a new line, and Enter while composing (IME) is not a submit', async () => {
    const wrapper = mountModal({}, { default: () => [h('textarea', { 'data-testid': 'message' }), h('input', { 'data-testid': 'email' })] });
    await settle();
    await key(byTestId('message')!, 'Enter');
    await key(byTestId('email')!, 'Enter', { isComposing: true });
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});

describe('FormModal: pending', () => {
  it('disables Save (with a spinner), Cancel and the close button, and marks the form busy', async () => {
    const wrapper = mountModal({ pending: true });
    await settle();
    expect(disabled(submitButton(wrapper))).toBe(true);
    expect(submitButton(wrapper).querySelector('ion-spinner')).not.toBeNull();
    expect(disabled(cancelButton(wrapper))).toBe(true);
    expect(disabled(closeButton(wrapper))).toBe(true);
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true');
  });

  it('nothing submits or cancels it meanwhile: clicks, Enter, Escape or the backdrop', async () => {
    const wrapper = mountModal({ pending: true });
    await settle();
    await click(submitButton(wrapper));
    await click(cancelButton(wrapper));
    await click(closeButton(wrapper));
    await key(byTestId('email')!, 'Enter');
    await key(byTestId('email')!, 'Escape');
    expect(modalEl(wrapper).getAttribute('data-backdrop-dismiss')).toBe('false');
    expect(modal(wrapper).tapBackdrop()).toBe(false);
    expect(wrapper.emitted('submit')).toBeUndefined();
    expect(wrapper.emitted('cancel')).toBeUndefined();
    expect(wrapper.emitted('update:open')).toBeUndefined();
  });

  it('without pending there is no spinner and the form is not busy', async () => {
    const wrapper = mountModal();
    await settle();
    expect(submitButton(wrapper).querySelector('ion-spinner')).toBeNull();
    expect(wrapper.get('form').attributes('aria-busy')).toBeUndefined();
  });

  it('`submitDisabled` disables Save and its Enter (an incomplete form)', async () => {
    const wrapper = mountModal({ submitDisabled: true });
    await settle();
    expect(disabled(submitButton(wrapper))).toBe(true);
    await click(submitButton(wrapper));
    await key(byTestId('email')!, 'Enter');
    expect(wrapper.emitted('submit')).toBeUndefined();
  });
});

describe('FormModal: focus', () => {
  it('on opening, focuses the first field', async () => {
    mountModal({}, { default: () => [h('p', 'Hint'), h('input', { 'data-testid': 'first' }), h('input', { 'data-testid': 'second' })] });
    await settle();
    expect(document.activeElement).toBe(byTestId('first'));
  });

  it('an Ionic field is focused through its setFocus() (Ionic moves the focus to its native input)', async () => {
    // Importing @ionic/vue defines its elements, ion-input among them.
    const IonInputElement = customElements.get('ion-input') as unknown as { prototype: { setFocus(): Promise<void> } };
    const setFocus = vi.spyOn(IonInputElement.prototype, 'setFocus').mockResolvedValue(undefined);
    try {
      mountModal({}, { default: () => [h('ion-input', { 'data-testid': 'name' })] });
      await settle();
      expect(setFocus).toHaveBeenCalledTimes(1);
      expect(setFocus.mock.contexts[0]).toBe(byTestId('name'));
    } finally {
      setFocus.mockRestore();
    }
  });

  it('a field marked `data-autofocus` goes first', async () => {
    mountModal({}, { default: () => [h('input', { 'data-testid': 'a' }), h('input', { 'data-testid': 'b', 'data-autofocus': '' })] });
    await settle();
    expect(document.activeElement).toBe(byTestId('b'));
  });

  it('with no field, Cancel takes the focus (the least destructive choice), on its native button: Enter presses it', async () => {
    const wrapper = mountModal({}, { default: () => [h('p', 'Nothing to fill in')] });
    await settle();
    expect(reallyFocused(cancelButton(wrapper))).toBe(true);
  });

  // The dialog says it has opened about half a second after it shows, and by then a person may already
  // be in another field: what they type would land in the first one and theirs stay empty.
  const opened = (wrapper: VueWrapper): void => {
    wrapper.findComponent({ name: 'IonModal' }).vm.$emit('didPresent');
  };

  it('a person already in another field keeps it when the dialog ends opening', async () => {
    const wrapper = mountModal({}, { default: () => [h('input', { 'data-testid': 'first' }), h('input', { 'data-testid': 'second' })] });
    await settle();
    byTestId('second')?.focus();
    opened(wrapper);
    await settle();
    expect(document.activeElement).toBe(byTestId('second'));
  });

  it('a person already in another field keeps it over a `data-autofocus` one', async () => {
    const wrapper = mountModal({}, { default: () => [h('input', { 'data-testid': 'a' }), h('input', { 'data-testid': 'b', 'data-autofocus': '' })] });
    await settle();
    byTestId('a')?.focus();
    opened(wrapper);
    await settle();
    expect(document.activeElement).toBe(byTestId('a'));
  });

  it('on closing, gives the focus back to what opened it', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Invite';
    document.body.append(trigger);
    trigger.focus();
    const wrapper = mountModal({ open: false });
    await settle();
    await wrapper.setProps({ open: true });
    await settle();
    expect(document.activeElement).toBe(byTestId('email'));
    await click(cancelButton(wrapper));
    expect(document.activeElement).toBe(trigger);
  });

  it('on closing, gives the focus back to an ion-button that opened it, on its native button (ui#73)', async () => {
    // The usual opener: a page's «New» or «Edit» ion-button. Focused, the document only sees its host.
    const trigger = document.createElement('ion-button');
    trigger.textContent = 'Invite';
    document.body.append(trigger);
    await settle();
    nativeOf(trigger)?.focus();
    expect(reallyFocused(trigger)).toBe(true);
    const wrapper = mountModal({ open: false });
    await settle();
    await wrapper.setProps({ open: true });
    await settle();
    expect(document.activeElement).toBe(byTestId('email'));
    await click(cancelButton(wrapper));
    expect(reallyFocused(trigger)).toBe(true);
  });
});

describe('FormModal entry points', () => {
  it('is exported from its folder, from `@erplora/ui/components` and from the package root', () => {
    expect(entry.FormModal).toBe(FormModal);
    expect((components as Record<string, unknown>).FormModal).toBe(FormModal);
    expect((root as Record<string, unknown>).FormModal).toBe(FormModal);
  });
});
