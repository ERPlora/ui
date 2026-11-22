import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import DateField from './DateField.vue';
import DateTimeField from './DateTimeField.vue';
import * as entry from './index';
import TimeField from './TimeField.vue';

describe('DateField, TimeField and DateTimeField entry points', () => {
  it('the folder exports the three fields, and nothing of what they share', () => {
    expect(Object.keys(entry).sort()).toEqual(['DateField', 'DateTimeField', 'TimeField']);
    expect([entry.DateField, entry.TimeField, entry.DateTimeField]).toEqual([DateField, TimeField, DateTimeField]);
  });

  it('they are part of `@erplora/ui/components` and of the package root', () => {
    for (const name of ['DateField', 'TimeField', 'DateTimeField']) {
      expect((components as Record<string, unknown>)[name], name).toBe((entry as Record<string, unknown>)[name]);
      expect((root as Record<string, unknown>)[name], name).toBe((entry as Record<string, unknown>)[name]);
    }
  });
});
