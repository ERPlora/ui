import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import Combo from './Combo.vue';
import * as entry from './index';

describe('Combo entry points', () => {
  it('the folder exports the component', () => {
    expect(entry.Combo).toBe(Combo);
  });

  it('is part of `@erplora/ui/components` and of the package root', () => {
    expect((components as Record<string, unknown>).Combo).toBe(Combo);
    expect((root as Record<string, unknown>).Combo).toBe(Combo);
  });
});
