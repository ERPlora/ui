import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import ColorInput from './ColorInput.vue';
import * as entry from './index';

describe('ColorInput entry points', () => {
  it('the folder exports the component', () => {
    expect(entry.ColorInput).toBe(ColorInput);
  });

  it('is part of `@erplora/ui/components` and of the package root', () => {
    expect((components as Record<string, unknown>).ColorInput).toBe(ColorInput);
    expect((root as Record<string, unknown>).ColorInput).toBe(ColorInput);
  });
});
