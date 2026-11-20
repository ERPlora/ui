import { describe, expect, it } from 'vitest';

import { isSaid, nameOf, shownMessageOf } from './formFields';

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
});
