import { describe, expect, it } from 'vitest';

import { isSaid, nameOf, repeatsAFieldReason, saidUnderAField, shownMessageOf } from './formFields';

const IONIC_FIELDS = ['ion-input', 'ion-textarea', 'ion-select', 'ion-checkbox', 'ion-toggle', 'ion-radio-group', 'ion-range'];

function field(tag: string, props: { name?: unknown; errorText?: unknown } = {}): Element {
  return Object.assign(document.createElement(tag), props);
}

function form(html: string): Element {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

describe('formFields', () => {
  it('a field says its name and the message it shows by its properties, nothing when empty', () => {
    expect(nameOf(field('ion-input', { name: 'email' }))).toBe('email');
    expect(nameOf(field('input', { name: '' }))).toBeNull();
    expect(shownMessageOf(field('ion-select', { errorText: 'Required.' }))).toBe('Required.');
    expect(shownMessageOf(field('ion-select', { errorText: 3 }))).toBeNull();
  });

  it.each(IONIC_FIELDS)('a reason is said by an %s only while it paints its message (invalid and touched)', (tag) => {
    const root = form('');
    const input = field(tag, { errorText: 'Required.' });
    root.append(input);
    expect(isSaid(root, 'Required.')).toBe(false);
    input.classList.add('ion-invalid');
    expect(isSaid(root, 'Required.')).toBe(false);
    input.classList.add('ion-touched');
    expect(isSaid(root, 'Required.')).toBe(true);
  });

  it('a reason the page writes itself is said; the banner and the Ionic fields\' own text are not', () => {
    expect(isSaid(form('<label>Customer <small>Pick a customer.</small></label>'), 'Pick a customer.')).toBe(true);
    expect(isSaid(form('<div class="ep-form-modal__error">Pick a customer.</div>'), 'Pick a customer.')).toBe(false);
    expect(isSaid(form('<ion-input><div>Pick a customer.</div></ion-input>'), 'Pick a customer.')).toBe(false);
  });

  describe('a refusal whose message is the reason of one of its fields (a name another record has)', () => {
    const TAKEN = { status: 409, code: 'cash_register.register_exists', message: 'Taken.', fields: { name: 'Taken.' } };

    it('repeats that reason; another message, a refusal without fields or the whole form\'s reason do not', () => {
      expect(repeatsAFieldReason(TAKEN)).toBe(true);
      expect(repeatsAFieldReason({ ...TAKEN, message: 'Check the highlighted details.' })).toBe(false);
      expect(repeatsAFieldReason({ status: 409, code: 'conflict', message: 'Taken.' })).toBe(false);
      expect(repeatsAFieldReason({ ...TAKEN, fields: { __all__: 'Taken.' } })).toBe(false);
      expect(repeatsAFieldReason(null)).toBe(false);
    });

    it('is said under a field only while a field paints it or the page writes it', () => {
      const root = form('');
      const input = field('ion-input', { errorText: 'Taken.' });
      root.append(input);
      expect(saidUnderAField(root, TAKEN)).toBe(false);
      input.classList.add('ion-invalid', 'ion-touched');
      expect(saidUnderAField(root, TAKEN)).toBe(true);
      expect(saidUnderAField(form('<small>Taken.</small>'), TAKEN)).toBe(true);
      expect(saidUnderAField(root, { ...TAKEN, message: 'Check the highlighted details.' })).toBe(false);
    });
  });
});
