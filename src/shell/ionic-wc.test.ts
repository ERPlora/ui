import { describe, expect, it } from 'vitest';

import { IONIC_WC_TAGS, registerOutfitkitIonicDeps } from './ionic-wc';

describe('registerOutfitkitIonicDeps', () => {
  it('lists the ion-* elements that ok-* components render inside their shadow roots', () => {
    expect(IONIC_WC_TAGS).toEqual(
      expect.arrayContaining(['ion-button', 'ion-icon', 'ion-input', 'ion-select', 'ion-modal', 'ion-toast']),
    );
  });

  it('registers every one of them', () => {
    registerOutfitkitIonicDeps();
    for (const tag of IONIC_WC_TAGS) expect(customElements.get(tag), tag).toBeDefined();
  });

  it('is idempotent: a second call does not throw nor redefine', () => {
    const before = customElements.get('ion-button');
    expect(() => registerOutfitkitIonicDeps()).not.toThrow();
    expect(customElements.get('ion-button')).toBe(before);
  });
});
