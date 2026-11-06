// Behaviour spec of FormModal: the dialog of the panel's short forms (invite, change role, new API
// key, billing details; mockups `business.html`, `billing.html`, README §3b): an `ion-modal` with
// a title and a close button, the fields (default slot) and a footer Cancel / Save. It never closes
// itself on submit (the page closes it when the command succeeds); it closes on Cancel, the close
// button, Escape and the backdrop, unless a submit is pending.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount, type VueWrapper } from '@vue/test-utils';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IonInput, IonSelect, IonTextarea } from '@ionic/vue';
import { h, nextTick } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import * as root from '../../index';
import * as components from '../index';
import { ApiError } from '../../sdk/errors';
import { Combo } from '../Combo';
import FormModal from './FormModal.vue';
import * as entry from './index';
import type { IonModalStubApi } from './__tests__/ionModalStub';

vi.mock('@ionic/vue', async (importOriginal) => {
  const { IonModalStub } = await import('./__tests__/ionModalStub');
  return { ...(await importOriginal<typeof import('@ionic/vue')>()), IonModal: IonModalStub };
});

const HERE = dirname(fileURLToPath(import.meta.url));

type Props = InstanceType<typeof FormModal>['$props'];
type Slots = Record<string, (props: Record<string, unknown>) => unknown>;

const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) wrapper.unmount();
  document.body.innerHTML = '';
});

/** Mounted as a page uses it: `v-model:open` (the dialog's own `open = false` closes it). */
function mountModal(props: Partial<Props> = {}, slots: Slots = {}, locale = 'en'): VueWrapper {
  const wrapper: VueWrapper = mount(FormModal, {
    props: {
      title: 'Invite to Bakery',
      open: true,
      'onUpdate:open': (value: boolean) => wrapper.setProps({ open: value }),
      ...props,
    } as Props,
    slots: { default: () => [h('input', { 'data-testid': 'email', type: 'email' })], ...slots } as never,
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale })] },
  });
  mounted.push(wrapper);
  return wrapper;
}

/** Lets Vue render and the modal's `didPresent` (next tick) land. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await nextTick();
    await new Promise((r) => setTimeout(r, 0));
  }
}

const modalEl = (w: VueWrapper): HTMLElement => w.get('[data-stub="ion-modal"]').element as HTMLElement;
const modal = (w: VueWrapper): IonModalStubApi =>
  w.findComponent({ name: 'IonModal' }).vm as unknown as IonModalStubApi;
const byTestId = (id: string): HTMLElement | null => document.querySelector(`[data-testid="${id}"]`);
const disabled = (el: Element): boolean =>
  (el as HTMLElement & { disabled?: boolean }).disabled === true || el.hasAttribute('disabled');
const click = async (el: Element | null): Promise<void> => {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await settle();
};
const key = async (el: Element, k: string, init: KeyboardEventInit = {}): Promise<void> => {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
  await settle();
};
const submitButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__submit').element as HTMLElement;
const cancelButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__cancel').element as HTMLElement;
const closeButton = (w: VueWrapper): HTMLElement => w.get('.ep-form-modal__close').element as HTMLElement;
/** The name a screen reader reads. Hydrated, `ion-button` moves `aria-label` from its host to the
 *  native button of its shadow root (Ionic's `inheritAriaAttributes`), as in a browser. */
const accessibleName = (button: HTMLElement): string | null | undefined =>
  button.shadowRoot?.querySelector('button')?.getAttribute('aria-label') ?? button.getAttribute('aria-label');
/** The native control of an `ion-button` (its `native` shadow part): the only part of it that takes
 *  the focus in a browser — its host has no tabindex and its shadow root does not delegate the focus. */
const nativeOf = (button: HTMLElement): HTMLElement | null =>
  button.shadowRoot?.querySelector<HTMLElement>('[part~="native"]') ?? null;
/** Focused for real, as a browser sees it: happy-dom focuses any element, an `ion-button` host
 *  included, so the focus has to be on the native control inside its shadow root (ui#73). */
const reallyFocused = (button: HTMLElement): boolean =>
  document.activeElement === button && nativeOf(button) !== null && button.shadowRoot?.activeElement === nativeOf(button);

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

describe('FormModal: errors', () => {
  it('shows the error of the command at the top, in a danger InlineFeedback', async () => {
    const wrapper = mountModal({ error: { status: 409, code: 'hubs.member_exists', message: 'That person is already a member.' } });
    await settle();
    const banner = wrapper.get('.ep-form-modal__error');
    expect(banner.classes()).toContain('inline-feedback');
    expect(banner.attributes('data-tone')).toBe('danger');
    expect(banner.text()).toContain('That person is already a member.');
    const body = wrapper.get('.ep-form-modal__body').element;
    expect(body.firstElementChild).toBe(banner.element);
  });

  it('no error, no banner', async () => {
    const wrapper = mountModal({ error: null });
    await settle();
    expect(wrapper.find('.ep-form-modal__error').exists()).toBe(false);
  });

  it('hands the field errors (422 `fields`) to the fields slot, and `{}` without them', async () => {
    const seen: unknown[] = [];
    const slot = (props: Record<string, unknown>) => {
      seen.push(props.fieldErrors);
      return [h('input')];
    };
    const wrapper = mountModal(
      { error: { status: 422, code: 'validation_error', message: 'Check the fields.', fields: { email: 'Not a valid email.' } } },
      { default: slot },
    );
    await settle();
    expect(seen.at(-1)).toEqual({ email: 'Not a valid email.' });
    await wrapper.setProps({ error: null });
    await settle();
    expect(seen.at(-1)).toEqual({});
  });
});

describe('FormModal: the notice of a refusal by fields', () => {
  const REFUSED = {
    status: 422,
    code: 'invalid_payload',
    message: 'Check the highlighted details.',
    fields: { email: 'Not a valid email.' },
  };
  const notice = (w: VueWrapper) => w.find('.ep-form-modal__error');
  const fire = async (id: string, event: Event): Promise<void> => {
    byTestId(id)?.dispatchEvent(event);
    await settle();
  };
  const typed = (): Event => new Event('input', { bubbles: true });
  const changed = (): Event => new CustomEvent('ionChange', { bubbles: true, composed: true });
  const emailField = () => h('input', { 'data-testid': 'email' });
  /** A window that says what was refused: the notice has something to point at (hub#833). */
  const mountMarked = (props: Partial<Props>, field: () => unknown = emailField): VueWrapper =>
    mountModal(props, {
      default: (slot) => [field(), h('small', (slot.fieldErrors as Readonly<Record<string, string>>).email)],
    });

  it('goes away as soon as a field is corrected; a field it cannot tell (no name, no message shown) keeps its message', async () => {
    const seen: unknown[] = [];
    const slot = (props: Record<string, unknown>) => {
      seen.push(props.fieldErrors);
      return [emailField(), h('small', (props.fieldErrors as Readonly<Record<string, string>>).email)];
    };
    const wrapper = mountModal({ error: REFUSED }, { default: slot });
    await settle();
    expect(notice(wrapper).text()).toContain('Check the highlighted details.');

    await fire('email', typed());

    expect(notice(wrapper).exists()).toBe(false);
    expect(seen.at(-1)).toEqual({ email: 'Not a valid email.' });
  });

  it('goes away when a select or a toggle changes (they only speak by ionChange)', async () => {
    const wrapper = mountMarked({ error: REFUSED }, () => h('ion-select', { 'data-testid': 'kind' }));
    await settle();
    await fire('kind', changed());
    expect(notice(wrapper).exists()).toBe(false);
  });

  it("stays when a text field only says on blur that it changed (Enter sent it, nothing was corrected)", async () => {
    const wrapper = mountMarked({ error: REFUSED }, () => h('ion-input', { 'data-testid': 'email' }));
    await settle();
    await fire('email', changed());
    expect(notice(wrapper).exists()).toBe(true);
  });

  it("stays while the person only searches in a field's own popover", async () => {
    const wrapper = mountMarked({ error: REFUSED }, () => h('ion-popover', [h('input', { 'data-testid': 'search' })]));
    await settle();
    await fire('search', typed());
    expect(notice(wrapper).exists()).toBe(true);
  });

  it('is not brought back by a parent that re-renders the same refusal', async () => {
    const wrapper = mountMarked({ error: REFUSED });
    await settle();
    await fire('email', typed());
    await wrapper.setProps({ error: { ...REFUSED, fields: { ...REFUSED.fields } } });
    await settle();
    expect(notice(wrapper).exists()).toBe(false);
  });

  it('comes back when the next try is refused too, even with the same words', async () => {
    const wrapper = mountMarked({ error: REFUSED });
    await settle();
    await fire('email', typed());
    await click(submitButton(wrapper));
    expect(wrapper.emitted('submit')).toHaveLength(1);
    expect(notice(wrapper).exists()).toBe(true);

    await fire('email', typed());
    await wrapper.setProps({ error: null });
    await settle();
    await wrapper.setProps({ error: REFUSED });
    await settle();
    expect(notice(wrapper).exists()).toBe(true);
  });

  it('comes back on a new opening with the refusal still there', async () => {
    const wrapper = mountMarked({ error: REFUSED });
    await settle();
    await fire('email', typed());
    await wrapper.setProps({ open: false });
    await settle();
    await wrapper.setProps({ open: true });
    await settle();
    expect(notice(wrapper).exists()).toBe(true);
  });

  it('a refusal of the whole form stays while the person types, alone or beside a field: nothing else says its reason', async () => {
    const refusals: Record<string, string>[] = [
      { __all__: 'The end cannot be before the start.' },
      { __all__: 'The end cannot be before the start.', email: 'Not a valid email.' },
    ];
    for (const fields of refusals) {
      const wrapper = mountMarked({ error: { status: 422, code: 'invalid_payload', message: 'The end cannot be before the start.', fields } });
      await settle();
      await fire('email', typed());
      expect(notice(wrapper).text()).toContain('The end cannot be before the start.');
      wrapper.unmount();
    }
  });

  it("comes back for another refusal of the SDK with other words, though its fields are the same", async () => {
    const fields = { email: 'Not a valid email.' };
    const wrapper = mountMarked({ error: new ApiError(422, 'invalid_payload', 'Check the highlighted details.', fields) });
    await settle();
    await fire('email', typed());
    expect(notice(wrapper).exists()).toBe(false);

    await wrapper.setProps({ error: new ApiError(422, 'invalid_payload', 'That email is already in use.', fields) });
    await settle();
    expect(notice(wrapper).text()).toContain('That email is already in use.');
  });

  it('a refusal without fields stays while the person types: nothing else says it', async () => {
    const wrapper = mountModal({ error: { status: 409, code: 'hubs.member_exists', message: 'Already a member.' } });
    await settle();
    await fire('email', typed());
    expect(notice(wrapper).text()).toContain('Already a member.');
  });
});

describe('FormModal: the message of a refused field (ui#89)', () => {
  // Odoo, WooCommerce, Shopify and the form libraries: a field the server refused stops saying so as
  // soon as the person changes it (types or chooses), never on focus or blur; the others keep theirs
  // until they are changed too, and the next refusal says them all again.
  const REFUSED = {
    status: 422,
    code: 'invalid_payload',
    message: 'Check the highlighted details.',
    fields: { email: 'Not a valid email.', name: 'Too long.' },
  };
  type FieldErrors = Readonly<Record<string, string>>;
  const notice = (w: VueWrapper) => w.find('.ep-form-modal__error');
  const typed = (): Event => new Event('input', { bubbles: true });
  const changed = (): Event => new CustomEvent('ionChange', { bubbles: true, composed: true });
  /** Where a keystroke lands: the native input Ionic renders inside its field. */
  const nativeInput = (id: string): HTMLInputElement => {
    const native = byTestId(id)?.querySelector('input');
    if (!native) throw new Error(`no native input in ${id}`);
    return native;
  };
  const fire = async (el: Element, event: Event): Promise<void> => {
    el.dispatchEvent(event);
    await settle();
  };
  const errorTextOf = (id: string): unknown => (byTestId(id) as (HTMLElement & { errorText?: unknown }) | null)?.errorText;
  /** The fields as a page writes them: `:error-text="fieldErrors.<key>"` and red while it has one. */
  const ionField = (component: unknown, id: string, message: string | undefined, extra: Record<string, unknown> = {}) =>
    h(component as never, {
      'data-testid': id,
      label: id,
      errorText: message,
      class: { 'ion-invalid': !!message, 'ion-touched': !!message },
      ...extra,
    });
  function mountFields(error: unknown, fields: (errors: FieldErrors) => unknown[]): { wrapper: VueWrapper; seen: FieldErrors[] } {
    const seen: FieldErrors[] = [];
    const wrapper = mountModal({ error } as Partial<Props>, {
      default: (props) => {
        const errors = props.fieldErrors as FieldErrors;
        seen.push(errors);
        return fields(errors);
      },
    });
    return { wrapper, seen };
  }

  it('goes away as soon as the person types in that field, which it finds by the message it shows; the others keep theirs', async () => {
    const { seen } = mountFields(REFUSED, (errors) => [
      ionField(IonInput, 'email', errors.email),
      ionField(IonInput, 'name', errors.name),
    ]);
    await settle();
    expect(errorTextOf('email')).toBe('Not a valid email.');

    await fire(nativeInput('email'), typed());

    expect(seen.at(-1)).toEqual({ name: 'Too long.' });
    expect(errorTextOf('email')).toBeFalsy();
    expect(byTestId('email')?.classList.contains('ion-invalid')).toBe(false);
    expect(errorTextOf('name')).toBe('Too long.');
    expect(byTestId('name')?.classList.contains('ion-invalid')).toBe(true);
  });

  it('goes away as soon as the person types in a textarea (its keystroke lands on the native textarea)', async () => {
    const { seen } = mountFields({ ...REFUSED, fields: { message: 'Too long.', email: 'Not a valid email.' } }, (errors) => [
      ionField(IonTextarea, 'message', errors.message),
      ionField(IonInput, 'email', errors.email),
    ]);
    await settle();
    const native = byTestId('message')?.querySelector('textarea');
    if (!native) throw new Error('no native textarea');
    await fire(native, typed());
    expect(seen.at(-1)).toEqual({ email: 'Not a valid email.' });
  });

  it('goes away when a select is changed (it only speaks by ionChange)', async () => {
    const { seen } = mountFields({ ...REFUSED, fields: { kind: 'Pick a kind.', name: 'Too long.' } }, (errors) => [
      ionField(IonSelect, 'kind', errors.kind),
      ionField(IonInput, 'name', errors.name),
    ]);
    await settle();
    await fire(byTestId('kind')!, changed());
    expect(seen.at(-1)).toEqual({ name: 'Too long.' });
  });

  it("goes away when a Combo's choice is told from its wrapper (the field inside it shows the message)", async () => {
    const countries = [{ id: 'ES', label: 'España' }];
    const { seen, wrapper } = mountFields({ ...REFUSED, fields: { country: 'Pick a country.' } }, (errors) => [
      h(Combo, { label: 'Country', options: countries, testid: 'country', errorText: errors.country }),
    ]);
    await settle();
    expect(seen.at(-1)).toEqual({ country: 'Pick a country.' });
    await fire(wrapper.get('.combo').element, typed());
    expect(seen.at(-1)).toEqual({});
  });

  it('a field named like its key clears its own message, even when another field shows the same words', async () => {
    const { seen } = mountFields({ ...REFUSED, fields: { first_name: 'Required.', last_name: 'Required.' } }, (errors) => [
      h('input', { 'data-testid': 'first', name: 'first_name', 'aria-description': errors.first_name }),
      h('input', { 'data-testid': 'last', name: 'last_name', 'aria-description': errors.last_name }),
    ]);
    await settle();
    await fire(byTestId('last')!, typed());
    expect(seen.at(-1)).toEqual({ first_name: 'Required.' });
  });

  it('two unnamed fields showing the same words: it does not guess, both keep their message', async () => {
    const { seen } = mountFields({ ...REFUSED, fields: { first_name: 'Required.', last_name: 'Required.' } }, (errors) => [
      ionField(IonInput, 'first', errors.first_name),
      ionField(IonInput, 'last', errors.last_name),
    ]);
    await settle();
    await fire(nativeInput('first'), typed());
    expect(seen.at(-1)).toEqual({ first_name: 'Required.', last_name: 'Required.' });
  });

  it('a wrapper with several fields inside tells nothing about which one changed', async () => {
    const { seen, wrapper } = mountFields(REFUSED, (errors) => [
      h('div', { class: 'pair' }, [ionField(IonInput, 'email', errors.email), ionField(IonInput, 'name', errors.name)]),
    ]);
    await settle();
    await fire(wrapper.get('.pair').element, typed());
    expect(seen.at(-1)).toEqual(REFUSED.fields);
  });

  it('stays on focus, and on the blur of a text field (its ionChange only repeats what was typed)', async () => {
    const { seen } = mountFields(REFUSED, (errors) => [ionField(IonInput, 'email', errors.email)]);
    await settle();
    await fire(nativeInput('email'), new FocusEvent('focusin', { bubbles: true }));
    await fire(byTestId('email')!, changed());
    expect(seen.at(-1)).toEqual(REFUSED.fields);
  });

  it("stays while the person searches in a field's own popover, though that box shows the same words", async () => {
    const { seen } = mountFields(REFUSED, (errors) => [
      ionField(IonInput, 'email', errors.email),
      h('ion-popover', [ionField(IonInput, 'search', errors.email)]),
    ]);
    await settle();
    await fire(nativeInput('search'), typed());
    expect(seen.at(-1)).toEqual(REFUSED.fields);
  });

  it('the notice stays gone once every refused field is corrected', async () => {
    const { wrapper } = mountFields({ ...REFUSED, fields: { email: 'Not a valid email.' } }, (errors) => [
      ionField(IonInput, 'email', errors.email),
    ]);
    await settle();
    await fire(nativeInput('email'), typed());
    expect(notice(wrapper).exists()).toBe(false);
  });

  it('the reason of the whole form (`__all__`) is no field: typing never takes it away', async () => {
    const fields = { __all__: 'The end cannot be before the start.', email: 'Not a valid email.' };
    const { seen, wrapper } = mountFields({ ...REFUSED, message: fields.__all__, fields }, (errors) => [
      ionField(IonInput, 'email', errors.email),
      ionField(IonInput, 'all', errors.__all__),
    ]);
    await settle();
    await fire(nativeInput('email'), typed());
    await fire(nativeInput('all'), typed());
    expect(seen.at(-1)).toEqual({ __all__: 'The end cannot be before the start.' });
    expect(notice(wrapper).text()).toContain('The end cannot be before the start.');
  });

  it('typing the refused value back does not bring the message back: only the next refusal does', async () => {
    const { seen, wrapper } = mountFields(REFUSED, (errors) => [ionField(IonInput, 'email', errors.email)]);
    await settle();
    await fire(nativeInput('email'), typed());
    await fire(nativeInput('email'), typed());
    expect(seen.at(-1)).toEqual({ name: 'Too long.' });

    await click(submitButton(wrapper));
    await wrapper.setProps({ error: null });
    await settle();
    await wrapper.setProps({ error: REFUSED });
    await settle();
    expect(seen.at(-1)).toEqual(REFUSED.fields);
  });

  it('comes back when Save is pressed again while the page still shows the same refusal', async () => {
    const { seen, wrapper } = mountFields(REFUSED, (errors) => [ionField(IonInput, 'email', errors.email)]);
    await settle();
    await fire(nativeInput('email'), typed());
    await click(submitButton(wrapper));
    expect(seen.at(-1)).toEqual(REFUSED.fields);
  });

  it('comes back for another refusal, and on a new opening with the refusal still there', async () => {
    const { seen, wrapper } = mountFields(REFUSED, (errors) => [ionField(IonInput, 'email', errors.email)]);
    await settle();
    await fire(nativeInput('email'), typed());
    await wrapper.setProps({ error: { ...REFUSED, message: 'That email is already in use.' } });
    await settle();
    expect(seen.at(-1)).toEqual(REFUSED.fields);

    await fire(nativeInput('email'), typed());
    await wrapper.setProps({ open: false });
    await settle();
    await wrapper.setProps({ open: true });
    await settle();
    expect(seen.at(-1)).toEqual(REFUSED.fields);
  });

  it('a parent that re-renders the same refusal does not bring it back', async () => {
    const { seen, wrapper } = mountFields(REFUSED, (errors) => [ionField(IonInput, 'email', errors.email)]);
    await settle();
    await fire(nativeInput('email'), typed());
    await wrapper.setProps({ error: { ...REFUSED, fields: { ...REFUSED.fields } } });
    await settle();
    expect(seen.at(-1)).toEqual({ name: 'Too long.' });
  });
});

describe('FormModal: a refused field that nothing in the form says (hub#833)', () => {
  // A window that does not mark a refused field would promise marks that are not there: nothing tells the
  // person what to correct. FormModal says that reason itself, in the banner, until the next try.
  const NOTICE = 'Check the highlighted details.';
  const refusal = (fields: Record<string, string>, extra: Record<string, unknown> = {}) => ({
    status: 422,
    code: 'invalid_payload',
    message: NOTICE,
    fields,
    ...extra,
  });
  type FieldErrors = Readonly<Record<string, string>>;
  const banner = (w: VueWrapper) => w.find('.ep-form-modal__error');
  const typed = (): Event => new Event('input', { bubbles: true });
  const nativeInput = (id: string): HTMLInputElement => {
    const native = byTestId(id)?.querySelector('input');
    if (!native) throw new Error(`no native input in ${id}`);
    return native;
  };
  const type = async (id: string): Promise<void> => {
    nativeInput(id).dispatchEvent(typed());
    await settle();
  };
  /** A field as a page marks it: its message under it, and red while it has one. */
  const marked = (id: string, message: string | undefined, extra: Record<string, unknown> = {}) =>
    h(IonInput as never, {
      'data-testid': id,
      label: id,
      errorText: message,
      class: { 'ion-invalid': !!message, 'ion-touched': !!message },
      ...extra,
    });
  /** A field that shows none of what the server refused. */
  const blank = (id: string, extra: Record<string, unknown> = {}) =>
    h(IonInput as never, { 'data-testid': id, label: id, ...extra });
  const mountFields = (error: unknown, fields: (errors: FieldErrors) => unknown[]): VueWrapper =>
    mountModal({ error } as Partial<Props>, { default: (props) => fields(props.fieldErrors as FieldErrors) });

  it('with no field marked, it says the reason instead of promising marks', async () => {
    const wrapper = mountFields(refusal({ 'items.0.quantity': 'Must be above 0.' }), () => [blank('quantity')]);
    await settle();
    expect(banner(wrapper).text()).toContain('Must be above 0.');
    expect(banner(wrapper).text()).not.toContain(NOTICE);
  });

  it('with every field marked, the notice alone: the fields say the reasons', async () => {
    const wrapper = mountFields(refusal({ email: 'Not a valid email.', name: 'Too long.' }), (errors) => [
      marked('email', errors.email),
      marked('name', errors.name),
    ]);
    await settle();
    expect(banner(wrapper).text()).toContain(NOTICE);
    expect(banner(wrapper).text()).not.toContain('Not a valid email.');
    expect(banner(wrapper).text()).not.toContain('Too long.');
  });

  it('with some marked, the notice and only the reasons of the others', async () => {
    const wrapper = mountFields(refusal({ email: 'Not a valid email.', 'items.0.quantity': 'Must be above 0.' }), (errors) => [
      marked('email', errors.email),
      blank('quantity'),
    ]);
    await settle();
    expect(banner(wrapper).text()).toContain(NOTICE);
    expect(banner(wrapper).text()).toContain('Must be above 0.');
    expect(banner(wrapper).text()).not.toContain('Not a valid email.');
  });

  it('a reason the page writes itself under a field counts as said', async () => {
    const wrapper = mountFields(refusal({ customer: 'Choose a customer.' }), (errors) => [
      blank('customer'),
      h('small', { 'data-testid': 'customer-error' }, errors.customer),
    ]);
    await settle();
    expect(banner(wrapper).text()).toContain(NOTICE);
    expect(banner(wrapper).text()).not.toContain('Choose a customer.');
  });

  it("a field holding the message without being red says nothing: Ionic paints it only on `.ion-invalid.ion-touched`", async () => {
    const wrapper = mountFields(refusal({ email: 'Not a valid email.' }), (errors) => [blank('email', { errorText: errors.email })]);
    await settle();
    expect(banner(wrapper).text()).toContain('Not a valid email.');
    expect(banner(wrapper).text()).not.toContain(NOTICE);
  });

  it('the text an Ionic field renders hidden inside itself is not said: only its red state tells', async () => {
    const wrapper = mountFields(refusal({ email: 'Not a valid email.' }), () => [
      h(IonInput as never, { 'data-testid': 'email', label: 'email' }, () => [h('div', { class: 'error-text' }, 'Not a valid email.')]),
    ]);
    await settle();
    expect(banner(wrapper).text()).toContain('Not a valid email.');
  });

  it('says the same words once, though two fields were refused with them', async () => {
    const wrapper = mountFields(refusal({ 'items.0.quantity': 'Must be above 0.', 'items.1.quantity': 'Must be above 0.' }), () => [blank('quantity')]);
    await settle();
    expect(wrapper.findAll('.ep-form-modal__reason').map((reason) => reason.text())).toEqual(['Must be above 0.']);
  });

  it('stays while the person types elsewhere, because nothing else says it', async () => {
    const wrapper = mountFields(refusal({ 'items.0.quantity': 'Must be above 0.' }), () => [blank('label')]);
    await settle();
    await type('label');
    expect(banner(wrapper).text()).toContain('Must be above 0.');
  });

  it('goes away when the field named like it is changed, though it showed nothing', async () => {
    const wrapper = mountFields(refusal({ quantity: 'Must be above 0.' }), () => [blank('quantity', { name: 'quantity' })]);
    await settle();
    expect(banner(wrapper).text()).toContain('Must be above 0.');
    await type('quantity');
    expect(banner(wrapper).exists()).toBe(false);
  });

  it('beside a marked field, the notice goes with the first change and the reason with its own field', async () => {
    const wrapper = mountFields(refusal({ email: 'Not a valid email.', quantity: 'Must be above 0.' }), (errors) => [
      marked('email', errors.email, { name: 'email' }),
      blank('quantity', { name: 'quantity' }),
    ]);
    await settle();
    expect(banner(wrapper).text()).toContain(NOTICE);
    await type('email');
    expect(banner(wrapper).text()).not.toContain(NOTICE);
    expect(banner(wrapper).text()).toContain('Must be above 0.');
    await type('quantity');
    expect(banner(wrapper).exists()).toBe(false);
  });

  it('a refusal that lands with the dialog already open is read too: the way a real one arrives', async () => {
    const wrapper = mountFields(null, () => [blank('quantity')]);
    await settle();
    expect(banner(wrapper).exists()).toBe(false);
    await wrapper.setProps({ error: refusal({ quantity: 'Must be above 0.' }) });
    await settle();
    expect(banner(wrapper).text()).toContain('Must be above 0.');
    expect(banner(wrapper).text()).not.toContain(NOTICE);
  });

  it('a field marked when the refusal lands is read as marked: the notice, not its reason twice', async () => {
    const wrapper = mountFields(null, (errors) => [marked('email', errors.email)]);
    await settle();
    await wrapper.setProps({ error: refusal({ email: 'Not a valid email.' }) });
    await settle();
    expect(banner(wrapper).text()).toContain(NOTICE);
    expect(banner(wrapper).text()).not.toContain('Not a valid email.');
  });

  it('comes back when Save is pressed again while the page still shows the same refusal', async () => {
    const wrapper = mountFields(refusal({ quantity: 'Must be above 0.' }), () => [blank('quantity', { name: 'quantity' })]);
    await settle();
    await type('quantity');
    expect(banner(wrapper).exists()).toBe(false);
    await click(submitButton(wrapper));
    expect(banner(wrapper).text()).toContain('Must be above 0.');
  });

  it('another refusal is read again: what a field now says leaves the banner', async () => {
    const wrapper = mountFields(refusal({ quantity: 'Must be above 0.' }), (errors) => [blank('quantity'), marked('email', errors.email)]);
    await settle();
    expect(banner(wrapper).text()).toContain('Must be above 0.');
    await wrapper.setProps({ error: refusal({ email: 'Not a valid email.' }) });
    await settle();
    expect(banner(wrapper).text()).toContain(NOTICE);
    expect(banner(wrapper).text()).not.toContain('Must be above 0.');
    expect(banner(wrapper).text()).not.toContain('Not a valid email.');
  });

  it('a new opening with the refusal still there reads the form again', async () => {
    const wrapper = mountFields(refusal({ quantity: 'Must be above 0.' }), () => [blank('label')]);
    await settle();
    await click(cancelButton(wrapper));
    await wrapper.setProps({ open: true });
    await settle();
    expect(banner(wrapper).text()).toContain('Must be above 0.');
  });

  it('a refusal the form no longer has leaves nothing behind', async () => {
    const wrapper = mountFields(refusal({ quantity: 'Must be above 0.' }), () => [blank('label')]);
    await settle();
    await wrapper.setProps({ error: null });
    await settle();
    expect(banner(wrapper).exists()).toBe(false);
    await wrapper.setProps({ error: { status: 409, code: 'conflict', message: 'Someone else changed it.' } });
    await settle();
    expect(wrapper.findAll('.ep-form-modal__reason')).toHaveLength(0);
    expect(banner(wrapper).text()).toContain('Someone else changed it.');
  });

  it("another code's message says something of its own: it stays, with the reason under it", async () => {
    const wrapper = mountFields(refusal({ sku: 'Already in use.' }, { status: 409, code: 'inventory.sku_taken', message: 'That code belongs to another product.' }), () => [blank('name')]);
    await settle();
    expect(banner(wrapper).text()).toContain('That code belongs to another product.');
    expect(banner(wrapper).text()).toContain('Already in use.');
  });

  it('the reason of the whole form, which is the message itself, is not said twice', async () => {
    const reason = 'The end cannot be before the start.';
    const wrapper = mountFields(refusal({ __all__: reason, email: 'Not a valid email.' }, { message: reason }), (errors) => [marked('email', errors.email)]);
    await settle();
    expect(banner(wrapper).text()).toContain(reason);
    expect(wrapper.findAll('.ep-form-modal__reason')).toHaveLength(0);
  });

  it('the banner is not mistaken for a field: a reason with the words of its message is still a reason of the whole form', async () => {
    const reason = 'The end cannot be before the start.';
    const wrapper = mountFields(refusal({ __all__: reason }, { message: reason }), () => [blank('label')]);
    await settle();
    expect(banner(wrapper).text()).toContain(reason);
    await type('label');
    expect(banner(wrapper).text()).toContain(reason);
  });
});

describe('FormModal: a refusal lands where the person is (hub#833)', () => {
  // On a phone a long form scrolls, and the person who pressed Save is at its bottom: what the refusal says
  // is above them, and it looks as if nothing happened.
  const REFUSED = { status: 422, code: 'invalid_payload', message: 'Check the highlighted details.', fields: { email: 'Not a valid email.' } };
  const scrolled: Element[] = [];
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    scrolled.length = 0;
    spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(function (this: Element) {
      scrolled.push(this);
    });
  });
  afterEach(() => spy.mockRestore());
  const marked = (id: string, message: string | undefined, extra: Record<string, unknown> = {}) =>
    h(IonInput as never, { 'data-testid': id, label: id, errorText: message, class: { 'ion-invalid': !!message, 'ion-touched': !!message }, ...extra });
  const mountFields = (fields: (errors: Readonly<Record<string, string>>) => unknown[]): VueWrapper =>
    mountModal({ error: null }, { default: (props) => fields(props.fieldErrors as Readonly<Record<string, string>>) });

  it('brings the first marked field into view, without moving what is already seen', async () => {
    const wrapper = mountFields((errors) => [marked('name', errors.name), marked('email', errors.email), marked('phone', errors.phone)]);
    await settle();
    await wrapper.setProps({ error: { ...REFUSED, fields: { email: 'Not a valid email.', phone: 'Not a phone.' } } });
    await settle();
    expect(scrolled).toEqual([byTestId('email')]);
    expect(spy).toHaveBeenCalledWith({ block: 'nearest' });
  });

  it('with nothing marked, brings the banner, which says why', async () => {
    const wrapper = mountFields(() => [marked('name', undefined)]);
    await settle();
    await wrapper.setProps({ error: { status: 409, code: 'conflict', message: 'Someone else changed it.' } });
    await settle();
    expect(scrolled).toEqual([wrapper.get('.ep-form-modal__error').element]);
  });

  it('moves nothing without a refusal, when one goes away, or when the same one is re-rendered', async () => {
    const wrapper = mountFields((errors) => [marked('email', errors.email)]);
    await settle();
    expect(scrolled).toEqual([]);
    await wrapper.setProps({ error: REFUSED });
    await settle();
    scrolled.length = 0;
    await wrapper.setProps({ error: { ...REFUSED, fields: { ...REFUSED.fields } } });
    await settle();
    await wrapper.setProps({ error: null });
    await settle();
    expect(scrolled).toEqual([]);
  });

  it("a refusal going away moves nothing, though a field stays red by the page's own rule", async () => {
    const wrapper = mountFields(() => [marked('name', 'Say a name.')]);
    await settle();
    await wrapper.setProps({ error: REFUSED });
    await settle();
    scrolled.length = 0;
    await wrapper.setProps({ error: null });
    await settle();
    expect(scrolled).toEqual([]);
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
  // be in another field (hub#700): what they type would land in the first one and theirs stay empty.
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

  it('size: md by default (the mockups\' 480px dialog), sm for short confirmations', async () => {
    const md = mountModal();
    await settle();
    expect(modalEl(md).getAttribute('data-size')).toBe('md');
    const sm = mountModal({ size: 'sm' });
    await settle();
    expect(modalEl(sm).getAttribute('data-size')).toBe('sm');
  });

  it('Save takes an Ionic colour and an icon (the mockups\' «Send invitation» with its icon)', async () => {
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

describe('FormModal: on a phone (R-29)', () => {
  it('is a sheet by default and a centred card with `phoneLayout: card`, said on the ion-modal for the stylesheet', async () => {
    const sheet = mountModal();
    await settle();
    expect(modalEl(sheet).getAttribute('data-phone-layout')).toBe('sheet');
    const card = mountModal({ phoneLayout: 'card' });
    await settle();
    expect(modalEl(card).getAttribute('data-phone-layout')).toBe('card');
  });
});

describe('FormModal: layout (CSS, read from the stylesheet or computed in a happy-dom window)', () => {
  const sfc = readFileSync(join(HERE, 'FormModal.vue'), 'utf8');

  it('is a centred card on desktop, 480px (md) or 420px (sm) wide, its height by its content', () => {
    expect(sfc).toMatch(/ion-modal\.ep-form-modal\s*\{[^}]*--width:\s*480px;[^}]*--height:\s*auto;/);
    expect(sfc).toMatch(/ion-modal\.ep-form-modal\[data-size='sm'\]\s*\{[^}]*--width:\s*420px;/);
  });

  // R-29 (UX audit 2, 2026-10-14; Material 3 and iOS): a form on a phone is a sheet from the bottom
  // as tall as its fields, never a full-height page with ~600px of nothing under one field; it grows
  // to 90% of the screen and then its fields scroll between the title and the buttons. A
  // confirmation (`phoneLayout: 'card'`, ConfirmDialog) stays the centred card at every width.
  const STYLE = /<style>([\s\S]*?)<\/style>/.exec(sfc)?.[1] ?? '';

  // hub#760, hub#784: a select keeps what it has chosen on one line, so its minimum width is that line's, and the
  // one-column grid of a form grows to it, every field with it. Inside a dialog the chosen text takes the lines it needs.
  it('a select wraps what it has chosen, so no field grows past the dialog', () => {
    expect(STYLE).toMatch(/ion-modal\.ep-form-modal ion-select::part\(text\)\s*\{[^}]*white-space:\s*normal;/);
  });

  // ui#93: an outlined select floats its label over the top edge of its box, down to 8px inside it, and centres what it
  // has chosen in the 56px box, under Ionic's 1px margin. Measured in Chromium (hub `Nueva mesa`, lines of 18px): one line
  // starts at 19.5 and two at 10.5, clear of the label; three or more fill the box from 1px, and the label lies on them.
  // happy-dom lays nothing out and has no `::part`, so these numbers are the ones of that measure.
  describe('what an outlined select has chosen, against its floating label', () => {
    const LINE = 18;
    const BOX = 56;
    const IONIC_MARGIN = 1;
    const LABEL_BOTTOM = 8;
    // saas#272: the shared theme says it for every outlined select, those of a dialog with them, once.
    const THEME = readFileSync(join(HERE, '../../shell/theme/polish.css'), 'utf8');
    const OUTLINED_TEXT = /(?:^|\})\s*ion-select\.select-fill-outline::part\(text\)\s*\{([^}]*)\}/m;
    const padding = (): number => Number(/padding-block:\s*([\d.]+)px;/.exec(OUTLINED_TEXT.exec(THEME)?.[1] ?? '')?.[1] ?? 0);

    it('three lines or more start clear of the label, where two lines start', () => {
      const twoLinesStartAt = IONIC_MARGIN + (BOX - IONIC_MARGIN - 2 * LINE) / 2;
      const manyLinesStartAt = IONIC_MARGIN + padding();
      expect(manyLinesStartAt).toBeGreaterThan(LABEL_BOTTOM);
      expect(manyLinesStartAt).toBe(twoLinesStartAt);
    });

    it('one or two lines keep the height of any other field', () => {
      expect(IONIC_MARGIN + 2 * LINE + 2 * padding()).toBeLessThanOrEqual(BOX);
    });

    it('the dialog does not say it a second time', () => {
      expect(STYLE).not.toMatch(/select-fill-outline/);
    });

    // Without `fill` the label takes its own line above the text and a compact select keeps its height.
    it('a select that is not outlined gets no extra room', () => {
      expect(STYLE).not.toMatch(/ion-modal\.ep-form-modal ion-select::part\(text\)\s*\{[^}]*padding/);
    });
  });

  /** The dialog's stylesheet applied in a window `width` px wide (happy-dom computes the media
   *  queries, not the layout), on the DOM FormModal and Ionic render. */
  async function styleAt(width: number, phoneLayout: string, size = 'md') {
    const win = new Window({ width, height: 844 });
    win.document.head.innerHTML = `<style>${STYLE}</style>`;
    win.document.body.innerHTML = `
      <ion-modal class="ep-form-modal" data-size="${size}" data-phone-layout="${phoneLayout}">
        <div class="ion-delegate-host ion-page"><div class="ep-form-modal__content">
          <form class="ep-form-modal__form"><div class="ep-form-modal__body"></div><div class="ep-form-modal__footer"></div></form>
        </div></div>
      </ion-modal>`;
    /** The computed values of `props` on `selector`, read before the window closes. */
    const read = (selector: string, props: string[]): Record<string, string> => {
      const style = win.getComputedStyle(win.document.querySelector(selector)!);
      return Object.fromEntries(props.map((prop) => [prop, style.getPropertyValue(prop)]));
    };
    const styles = {
      modal: read('ion-modal', ['--width', '--max-width', '--height', '--max-height', '--border-radius', 'align-items']),
      host: read('.ion-delegate-host', ['display', 'max-height']),
      body: read('.ep-form-modal__body', ['overflow-y', 'min-height', 'max-height']),
    };
    await win.happyDOM.close();
    return styles;
  }

  it('below 640px a form is a sheet from the bottom, as tall as its content up to 90vh, the fields scrolling inside', async () => {
    const { modal, host, body } = await styleAt(390, 'sheet');
    expect(modal['--width']).toBe('100%');
    expect(modal['--height']).toBe('auto');
    expect(modal['--max-height']).toBe('90vh');
    expect(modal['align-items']).toBe('flex-end');
    // The sheet's rounded top (--ep-radius-sheet-top, 18px 18px 0 0 without the theme).
    expect(modal['--border-radius']).toBe('18px 18px 0 0');
    // The content is capped like the sheet, so the body scrolls instead of being cut off.
    expect(host['max-height']).toBe(`${(844 * 90) / 100}px`); // 90vh of the 844px window, computed
    expect(host.display).toBe('flex');
    expect(body['overflow-y']).toBe('auto');
    expect(body['min-height']).toBe('0');
    expect(body['max-height']).toBe('none');
  });

  it('a confirmation (`phoneLayout: card`) stays the centred card below 640px: never a sheet', async () => {
    const { modal } = await styleAt(390, 'card', 'sm');
    expect(modal['--width']).toBe('420px');
    expect(modal['--max-width']).toBe('calc(100vw - 32px)');
    expect(modal['--height']).toBe('auto');
    expect(modal['align-items']).not.toBe('flex-end');
    expect(modal['--border-radius']).not.toBe('18px 18px 0 0');
  });

  it('from 640px both are the centred card', async () => {
    for (const layout of ['sheet', 'card']) {
      const { modal } = await styleAt(1024, layout);
      expect(modal['--width'], layout).toBe('480px');
      expect(modal['--height'], layout).toBe('auto');
      expect(modal['align-items'], layout).not.toBe('flex-end');
    }
  });

  // hub#928: Ionic drops the backdrop and the shadow of a modal opened over another one (`ion-modal.modal-default.show-modal
  // ~ ion-modal.modal-default` in its core.css), a rule made for windows of one size that cover each other. The card is
  // narrower than a sheet (600px wide on a tablet) and the phone's sheet is only as tall as its fields, so what was behind
  // showed around it, neither dimmed nor apart, its words cut at the card's edges. Over another window it keeps both.
  describe('over another window (hub#928)', () => {
    const IONIC = readFileSync(join(HERE, '../../../node_modules/@ionic/vue/css/core.css'), 'utf8');
    const SHADOW = '0 18px 50px rgba(17, 24, 39, 0.18)';

    /** `front` presented after an open sheet (none with `alone`), with Ionic's stylesheet and the dialog's, in a window
     *  `width` px wide. */
    async function over(width: number, front: string, dark = false, alone = false) {
      const win = new Window({ width, height: 844 });
      if (dark) win.document.documentElement.classList.add('ion-palette-dark');
      // The dialog's rules first: they must win by what they say, not by coming after Ionic's (the bundle sets the order).
      win.document.head.innerHTML = `<style>:root { --ep-shadow-modal: ${SHADOW}; }</style><style>${STYLE}</style><style>${IONIC}</style>`;
      win.document.body.innerHTML = `<ion-app>
        ${alone ? '' : '<ion-modal class="ios modal-default show-modal" data-testid="sheet"></ion-modal>'}
        ${front}
      </ion-app>`;
      const style = win.getComputedStyle(win.document.querySelector('[data-testid=front]')!);
      const read = { backdrop: style.getPropertyValue('--backdrop-opacity'), shadow: style.getPropertyValue('--box-shadow') };
      await win.happyDOM.close();
      return read;
    }
    const dialog = (phoneLayout: string, size = 'md') =>
      `<ion-modal class="ep-form-modal ios modal-default show-modal" data-testid="front" data-size="${size}" data-phone-layout="${phoneLayout}"></ion-modal>`;

    it.each([
      [1440, 'sheet', 'md'],
      [820, 'sheet', 'md'],
      [1440, 'card', 'sm'],
      [390, 'sheet', 'md'],
      [390, 'card', 'sm'],
    ])('at %ipx (%s, %s) it dims the window behind as Ionic dims a lone modal, and keeps its shadow', async (width, layout, size) => {
      const { backdrop, shadow } = await over(width, dialog(layout, size));
      expect(backdrop).toBe('0.4');
      expect(shadow).toBe(SHADOW);
    });

    it('dark: the backdrop of a dialog over another window is as deep as the one over a page (UX audit U-90)', async () => {
      expect((await over(1440, dialog('sheet'), true)).backdrop).toBe('0.6');
    });

    // Over a page Ionic's own 0.4 (its shadow root's `:host`, which happy-dom does not apply) is what the dialog says now
    // itself, with the 0.6 of dark: one value per theme for both cases.
    it('over a page it says Ionic\'s 0.4 itself, and 0.6 in dark (UX audit U-90)', async () => {
      expect(await over(1440, dialog('sheet'), false, true)).toEqual({ backdrop: '0.4', shadow: SHADOW });
      expect((await over(1440, dialog('sheet'), true, true)).backdrop).toBe('0.6');
    });

    it('a window that is not a FormModal keeps Ionic\'s rule: nothing leaks to other modals', async () => {
      const { backdrop, shadow } = await over(1440, '<ion-modal class="ios modal-default show-modal" data-testid="front"></ion-modal>');
      expect(backdrop).toBe('0');
      expect(shadow).toBe('none');
    });
  });

  it('uses Ionic\'s spacing class and our tokens, nothing of OutfitKit', () => {
    expect(sfc).toMatch(/ion-padding/);
    expect(sfc).not.toMatch(/--ok-|\bok-[a-z]/);
  });
});

describe('FormModal entry points', () => {
  it('is exported from its folder, from `@erplora/ui/components` and from the package root', () => {
    expect(entry.FormModal).toBe(FormModal);
    expect((components as Record<string, unknown>).FormModal).toBe(FormModal);
    expect((root as Record<string, unknown>).FormModal).toBe(FormModal);
  });
});
