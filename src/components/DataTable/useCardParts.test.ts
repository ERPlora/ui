import { describe, expect, it } from 'vitest';

import type { DataTableColumn } from './types';
import { cardTitleColumn, useCardParts } from './useCardParts';

type Row = { id: string; code: string; name: string; currency: string };
const row: Row = { id: '1', code: 'L1', name: 'Tarifa mayorista 1', currency: 'EUR' };
const columns: DataTableColumn<Row>[] = [
  { key: 'code', label: 'Code' },
  { key: 'name', label: 'Name' },
  { key: 'currency', label: 'Currency' },
];

function parts(extra: { title?: (r: Row) => string; titleColumn?: string } = {}) {
  return useCardParts<Row>({
    columns: () => columns,
    visible: () => columns,
    title: () => extra.title,
    titleColumn: () => extra.titleColumn,
  });
}
const keys = (cols: DataTableColumn<Row>[]) => cols.map((c) => c.key);

describe('useCardParts', () => {
  it('the title comes from `cardTitle`, and the column that reads the same leaves the body', () => {
    const p = parts({ title: (r) => r.name });
    expect(p.cardTitleOf(row)).toBe('Tarifa mayorista 1');
    expect(p.cardTitleColumnOf(row)?.key).toBe('name');
    expect(keys(p.cardFields(row))).toEqual(['code', 'currency']);
  });

  it('a named title column gives the title its text and leaves the body', () => {
    const p = parts({ titleColumn: 'code' });
    expect(p.cardTitleOf(row)).toBe('L1');
    expect(keys(p.cardFields(row))).toEqual(['name', 'currency']);
  });

  it('without either, no title and every column in the body', () => {
    const p = parts();
    expect(p.cardTitleOf(row)).toBe('');
    expect(keys(p.cardFields(row))).toEqual(['code', 'name', 'currency']);
  });
});

describe('cardTitleColumn', () => {
  type Row = Record<string, unknown>;
  const col = (c: Partial<DataTableColumn<Row>> & { key: string }): DataTableColumn<Row> => ({ label: c.key, ...c });
  const cols = [col({ key: 'code' }), col({ key: 'name' }), col({ key: 'currency' })];
  const row = { code: 'L1', name: 'Tarifa mayorista 1', currency: 'EUR' };
  it('is the first column whose text reads like the title (trimmed, numbers too)', () => {
    expect(cardTitleColumn('Tarifa mayorista 1', row, cols)?.key).toBe('name');
    expect(cardTitleColumn(' L1 ', row, cols)?.key).toBe('code');
    expect(cardTitleColumn(12, { n: 12 }, [col({ key: 'n' })])?.key).toBe('n');
  });
  it('none for an empty title, a non-text title, or a column painted by a slot', () => {
    expect(cardTitleColumn('', row, cols)).toBeUndefined();
    expect(cardTitleColumn(null, row, cols)).toBeUndefined();
    expect(cardTitleColumn('Tarifa mayorista 1', row, [col({ key: 'name', cell: 'name-cell' })])).toBeUndefined();
  });
});
