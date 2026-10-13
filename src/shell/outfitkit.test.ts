import { describe, expect, it } from 'vitest';

import { OUTFITKIT_TAGS, registerOutfitkit } from './outfitkit';

describe('registerOutfitkit', () => {
  it('covers the components the shell and the demo use', () => {
    expect(OUTFITKIT_TAGS).toEqual(
      expect.arrayContaining(['ok-data-table', 'ok-inline-feedback', 'ok-empty-state', 'ok-status-pill', 'ok-pinpad']),
    );
  });

  it('defines every tag', async () => {
    await registerOutfitkit();
    for (const tag of OUTFITKIT_TAGS) expect(customElements.get(tag), tag).toBeDefined();
  });

  it('is idempotent: calling twice (even concurrently) does not throw', async () => {
    await expect(Promise.all([registerOutfitkit(), registerOutfitkit()])).resolves.toBeDefined();
    await expect(registerOutfitkit()).resolves.toBeUndefined();
  });
});
