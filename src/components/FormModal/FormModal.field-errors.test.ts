import type { VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IonInput, IonSelect, IonTextarea } from '@ionic/vue';
import { h } from 'vue';

import { Combo } from '../Combo';
import { byTestId, click, markedField, mountModal, settle, submitButton, unmountModals, type Props } from './__tests__/form-modal';

vi.mock('@ionic/vue', async (importOriginal) => (await import('./__tests__/ionModalStub')).ionicVueWithModalStub(importOriginal));

afterEach(unmountModals);

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
  const ionField = markedField;
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

  it('two Combos refused with the same words: a choice clears only the field named by the refusal', async () => {
    const options = [{ id: 'ES', label: 'España' }];
    const { seen, wrapper } = mountFields({ ...REFUSED, fields: { country: 'Required.', city: 'Required.' } }, (errors) => [
      h(Combo, { name: 'country', label: 'Country', options, testid: 'country', errorText: errors.country }),
      h(Combo, { name: 'city', label: 'City', options, testid: 'city', errorText: errors.city }),
    ]);
    await settle();
    await fire(wrapper.findAll('.combo')[1].element, typed());
    expect(seen.at(-1)).toEqual({ country: 'Required.' });
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

describe('FormModal: a refusal lands where the person is', () => {
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
    markedField(IonInput, id, message, extra);
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
