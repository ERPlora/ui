import { describe, expect, it, vi } from 'vitest';

import { patchIonicOnDefine } from './ionic-registry-hook';

describe('patchIonicOnDefine', () => {
  it('applies the patch to the constructor right before the tag is registered', () => {
    const patch = vi.fn();
    expect(patchIonicOnDefine(['x-hook-a'], patch)).toEqual([]);

    class A extends HTMLElement {}
    customElements.define('x-hook-a', A);

    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith(A);
  });

  it('does not patch tags it was not asked about', () => {
    const patch = vi.fn();
    patchIonicOnDefine(['x-hook-b'], patch);
    customElements.define('x-hook-other', class extends HTMLElement {});
    expect(patch).not.toHaveBeenCalled();
  });

  it('returns the tags that were already registered (too late to patch)', () => {
    customElements.define('x-hook-late', class extends HTMLElement {});
    expect(patchIonicOnDefine(['x-hook-late', 'x-hook-c'], vi.fn())).toEqual(['x-hook-late']);
  });

  it('registers the element unpatched, and says so, when the patch throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    patchIonicOnDefine(['x-hook-boom'], () => {
      throw new Error('boom');
    });
    customElements.define('x-hook-boom', class extends HTMLElement {});
    expect(customElements.get('x-hook-boom')).toBeDefined();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('does not stack the same patch twice for a tag', () => {
    const patch = vi.fn();
    patchIonicOnDefine(['x-hook-d'], patch);
    patchIonicOnDefine(['x-hook-d'], patch);
    customElements.define('x-hook-d', class extends HTMLElement {});
    expect(patch).toHaveBeenCalledTimes(1);
  });
});
