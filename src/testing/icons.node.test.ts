// @vitest-environment node
// An app's `vitest.setup.ts` also runs before its `@vitest-environment node` files (config tests,
// e2e helpers), so what it calls has to load and run without a DOM.
import { describe, expect, it } from 'vitest';

import { registerShellIcons } from './index';

describe('registerShellIcons without a DOM', () => {
  it('loads and runs without throwing, so a test setup can call it before any test file', () => {
    expect(typeof window).toBe('undefined');
    expect(() => registerShellIcons()).not.toThrow();
  });
});
