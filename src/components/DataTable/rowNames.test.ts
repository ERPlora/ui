import { afterEach, describe, expect, it } from 'vitest';

import en from './locales/en.json';
import es from './locales/es.json';
import { withRowNames } from './rowNames';
import type { DataTableAction } from './types';

type Row = { id: string; name: string };
const ROWS: Row[] = [
  { id: '1', name: 'Carlos Ruiz' },
  { id: '2', name: 'Ana Gil' },
];

afterEach(() => {
  document.documentElement.lang = '';
});

describe('withRowNames', () => {
  it('names each action with its row for a screen reader, its own label first', () => {
    const actions: DataTableAction<Row>[] = [
      { id: 'role', label: 'Change role', icon: 'create-outline' },
      { id: 'remove', label: (row) => `Remove #${row.id}`, menuOnly: true },
    ];
    const [role, remove] = withRowNames((row: Row) => row.name, actions);
    expect(ROWS.map((row) => role.ariaLabel?.(row))).toEqual(['Change role: Carlos Ruiz', 'Change role: Ana Gil']);
    expect(ROWS.map((row) => remove.ariaLabel?.(row))).toEqual(['Remove #1: Carlos Ruiz', 'Remove #2: Ana Gil']);
  });

  it('keeps everything else of each action as it was', () => {
    const hidden = () => false;
    const [role] = withRowNames((row: Row) => row.name, [
      { id: 'role', label: 'Change role', icon: 'create-outline', color: 'danger', pinned: true, hidden },
    ]);
    expect(role).toMatchObject({ id: 'role', label: 'Change role', icon: 'create-outline', color: 'danger', pinned: true, hidden });
  });

  it('is said in the language of the page, from the table’s own texts', () => {
    expect([en.dataTable.rowAction, es.dataTable.rowAction]).toEqual(['{action}: {name}', '{action}: {name}']);
    document.documentElement.lang = 'es';
    const [role] = withRowNames((row: Row) => row.name, [{ id: 'role', label: 'Cambiar rol' }]);
    expect(role.ariaLabel?.(ROWS[1])).toBe('Cambiar rol: Ana Gil');
  });
});
