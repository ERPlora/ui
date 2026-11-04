import { afterEach, describe, expect, it } from 'vitest';

import { focusedElement } from './focus';

afterEach(() => {
  document.body.replaceChildren();
});

describe('focusedElement', () => {
  it('nothing focused: none, never the body', () => {
    (document.activeElement as HTMLElement | null)?.blur();
    expect(focusedElement()).toBeNull();
  });

  it('a field of the page: the field', () => {
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    expect(focusedElement()).toBe(field);
  });

  it('inside a shadow root (an ion-button focused on its native button): the element itself, not its host', () => {
    const host = document.createElement('div');
    const inner = host.attachShadow({ mode: 'open' });
    const native = document.createElement('button');
    inner.append(native);
    document.body.append(host);
    native.focus();
    expect(document.activeElement).toBe(host);
    expect(focusedElement()).toBe(native);
  });
});
