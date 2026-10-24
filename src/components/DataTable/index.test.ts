import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import DataTable from './DataTable.vue';
import * as entry from './index';
import { syncSearchbarInputName } from './searchbarName';

describe('DataTable entry points', () => {
  it('the folder exports the component, its layout deciders and its icon names', () => {
    expect(entry.DataTable).toBe(DataTable);
    expect(typeof entry.decideRowActionsFit).toBe('function');
    expect(typeof entry.decideCardsForFit).toBe('function');
    expect(typeof entry.decideFitLevel).toBe('function');
    expect(entry.DATA_TABLE_ICONS.empty).toBe('file-tray-outline');
  });

  it('is part of `@erplora/ui/components` and of the package root', () => {
    expect((components as Record<string, unknown>).DataTable).toBe(DataTable);
    expect((root as Record<string, unknown>).DataTable).toBe(DataTable);
  });

  // A page with its own ion-searchbar (Files) names its input with the same helper as the table,
  // instead of a copy of it (base/UI-REQUESTS.md «Nombre del buscador»).
  it('shares the helper that names a searchbar input, from `@erplora/ui/components` and the root', () => {
    expect((components as Record<string, unknown>).syncSearchbarInputName).toBe(syncSearchbarInputName);
    expect((root as Record<string, unknown>).syncSearchbarInputName).toBe(syncSearchbarInputName);
  });
});
