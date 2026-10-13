import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import DataTable from './DataTable.vue';
import * as entry from './index';

describe('DataTable entry points', () => {
  it('the folder exports the component, its layout deciders and its icon names', () => {
    expect(entry.DataTable).toBe(DataTable);
    expect(typeof entry.decideRowActionsFit).toBe('function');
    expect(typeof entry.decideCardsForFit).toBe('function');
    expect(entry.DATA_TABLE_ICONS.empty).toBe('file-tray-outline');
  });

  it('is part of `@erplora/ui/components` and of the package root', () => {
    expect((components as Record<string, unknown>).DataTable).toBe(DataTable);
    expect((root as Record<string, unknown>).DataTable).toBe(DataTable);
  });
});
