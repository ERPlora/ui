import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IonInput } from '@ionic/vue';
import { h } from 'vue';

import { ApiError } from '../../sdk/errors';
import { byTestId, cancelButton, click, markedField, mountModal, settle, submitButton, unmountModals, type Props } from './__tests__/form-modal';

vi.mock('@ionic/vue', async (importOriginal) => (await import('./__tests__/ionModalStub')).ionicVueWithModalStub(importOriginal));

afterEach(unmountModals);

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
  /** A window that says what was refused: the notice has something to point at. */
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

describe('FormModal: a refused field that nothing in the form says', () => {
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
    markedField(IonInput, id, message, extra);
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

describe('FormModal: a refusal whose message is the reason of one of its fields', () => {
  // A drawer, a printer or a role with a name another one has: the server words the refusal and the field's reason
  // the same. It is said once, under the field, as Shopify Polaris and Material say a field's error; the banner
  // stays for what no field says.
  const TAKEN = 'There is already a drawer with that name.';
  const taken = (fields: Record<string, string> = { name: TAKEN }, extra: Record<string, unknown> = {}) => ({
    status: 409,
    code: 'cash_register.register_exists',
    message: TAKEN,
    fields,
    ...extra,
  });
  type FieldErrors = Readonly<Record<string, string>>;
  const banner = (w: VueWrapper) => w.find('.ep-form-modal__error');
  const times = (text: string, words: string): number => text.split(words).length - 1;
  const marked = (id: string, message: string | undefined) => markedField(IonInput, id, message, { name: id });
  const blank = (id: string) => h(IonInput as never, { 'data-testid': id, label: id, name: id });
  const mountFields = (error: unknown, fields: (errors: FieldErrors) => unknown[]): VueWrapper =>
    mountModal({ error } as Partial<Props>, { default: (props) => fields(props.fieldErrors as FieldErrors) });

  it('is said once, under the field that paints it: no banner repeats it', async () => {
    const wrapper = mountFields(taken(), (errors) => [marked('name', errors.name)]);
    await settle();
    expect((byTestId('name') as HTMLElement & { errorText?: string }).errorText).toBe(TAKEN);
    expect(banner(wrapper).exists()).toBe(false);
    expect(times(document.body.textContent ?? '', TAKEN)).toBe(0);
  });

  it('with the check of a refusal by fields too (a red warning before the amber one)', async () => {
    const reason = 'The red warning cannot come before the amber one.';
    const wrapper = mountFields(taken({ red: reason }, { status: 422, code: 'invalid_payload', message: reason }), (errors) => [marked('red', errors.red)]);
    await settle();
    expect(banner(wrapper).exists()).toBe(false);
  });

  it('never shows up on top, not even for a moment, when the refusal lands with the window open', async () => {
    const wrapper = mountFields(null, (errors) => [marked('name', errors.name)]);
    await settle();
    const added: string[] = [];
    const watcher = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element && (node.matches('.ep-form-modal__error') || node.querySelector('.ep-form-modal__error'))) added.push('banner');
        }
      }
    });
    watcher.observe(document.body, { childList: true, subtree: true });
    await wrapper.setProps({ error: taken() });
    await settle();
    watcher.disconnect();
    expect(added).toEqual([]);
  });

  it('a field that does not paint it leaves it on top, once', async () => {
    const wrapper = mountFields(taken(), () => [blank('name')]);
    await settle();
    expect(times(banner(wrapper).text(), TAKEN)).toBe(1);
  });

  it('beside a field nothing marks, the banner says only that field’s reason', async () => {
    const wrapper = mountFields(taken({ name: TAKEN, code: 'Already in use.' }), (errors) => [marked('name', errors.name), blank('code')]);
    await settle();
    expect(banner(wrapper).text()).toContain('Already in use.');
    expect(banner(wrapper).text()).not.toContain(TAKEN);
  });

  it('a new try refused the same way says it under the field again, and never on top', async () => {
    const wrapper = mountFields(taken(), (errors) => [marked('name', errors.name)]);
    await settle();
    await wrapper.setProps({ error: null });
    await settle();
    await wrapper.setProps({ error: taken() });
    await settle();
    expect((byTestId('name') as HTMLElement & { errorText?: string }).errorText).toBe(TAKEN);
    expect(banner(wrapper).exists()).toBe(false);
  });
});
