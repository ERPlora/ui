import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';

import type { LabelParams } from './labels';
import type { DataTableColumn, DataTableLabelKey } from './types';
import { useFilterControls } from './useFilterControls';

type Row = { id: string };
/** The label's key, and the column it names: the texts themselves are the catalogue's business. */
const label = (key: DataTableLabelKey, params?: LabelParams): string => (params ? `${key}(${params.label})` : key);

function setup(errors?: Record<string, string>) {
  const filterErrors = ref(errors);
  return { filterErrors, ...useFilterControls<Row>({ filterErrors: () => filterErrors.value, label }) };
}
const column = (key: string, filter: DataTableColumn<Row>['filter']): DataTableColumn<Row> => ({ key, label: 'Price', filter });

describe('useFilterControls', () => {
  it('names a filter by its key, the column’s by default, and a range by its first end', () => {
    const { filterName } = setup();
    expect(filterName(column('status', { type: 'select' }))).toBe('status');
    expect(filterName(column('status', { type: 'select', key: 'status_id' }))).toBe('status_id');
    expect(filterName(column('total', { type: 'range' }))).toBe('total_from');
  });

  it('a refused filter shows its message and marks its control and the funnel until its value changes', () => {
    const c = setup({ amount_from: '  Not a number ', status: ' ' });
    expect([c.errorOf('amount_from'), c.errorOf('status'), c.errorOf('total')]).toEqual(['Not a number', undefined, undefined]);
    expect([c.invalidMark('amount_from'), c.refused.value]).toEqual([{ 'ion-invalid': true, 'ion-touched': true }, true]);
    c.answerError('total');
    expect(c.errorOf('amount_from')).toBe('Not a number');
    c.answerError('amount_from');
    expect([c.errorOf('amount_from'), c.invalidMark('amount_from'), c.refused.value]).toEqual([
      undefined,
      { 'ion-invalid': false, 'ion-touched': false },
      false,
    ]);
  });

  it('a new answer of the server shows its messages again', async () => {
    const c = setup({ amount_from: 'Not a number' });
    c.answerError('amount_from');
    c.filterErrors.value = { amount_from: 'Not a number' };
    await nextTick();
    expect([c.errorOf('amount_from'), c.refused.value]).toEqual(['Not a number', true]);
  });

  it('a yes/no offers yes then no, a select its options, any other filter none', () => {
    const { choicesOf } = setup();
    const options = [{ value: 'paid', label: 'Paid' }];
    expect(choicesOf(column('active', { type: 'boolean' }))).toEqual([
      { value: 'true', label: 'filterYes' },
      { value: 'false', label: 'filterNo' },
    ]);
    expect(choicesOf(column('status', { type: 'select', options }))).toEqual(options);
    expect(choicesOf(column('status', { type: 'select' }))).toEqual([]);
    expect(choicesOf(column('name', { type: 'text' }))).toEqual([]);
  });

  it('a lookup names its value by the pick made here, else by the page’s selected one, else not at all', () => {
    const { lookupLabel, rememberPick } = setup();
    const customer = column('customer', { type: 'lookup', load: async () => [], selected: { value: '7', label: 'Ana' } });
    expect([lookupLabel(customer, '7'), lookupLabel(customer, '9'), lookupLabel(customer, undefined)]).toEqual(['Ana', undefined, undefined]);
    rememberPick('customer', '9', 'Luis');
    rememberPick('customer', '', 'Nobody');
    expect([lookupLabel(customer, '9'), lookupLabel(customer, '7')]).toEqual(['Luis', 'Ana']);
    expect(lookupLabel(column('customer', { type: 'text' }), '9')).toBeUndefined();
  });

  it('a range’s ends carry their names, hints and accessible names, in boxes by the kind of range', () => {
    const { rangeEnds, endBox } = setup();
    expect(rangeEnds(column('price', { type: 'range', keys: ['priceMin', 'priceMax'] }))).toEqual([
      { name: 'priceMin', hint: 'filterFrom', named: 'filterFromOf(Price)' },
      { name: 'priceMax', hint: 'filterTo', named: 'filterToOf(Price)' },
    ]);
    expect(endBox(column('total', { type: 'range', amount: true }))).toEqual({ type: 'text', inputmode: 'decimal' });
    expect(endBox(column('rate', { type: 'range', min: 0, max: 100, step: 5 }))).toEqual({
      type: 'number',
      inputmode: 'decimal',
      min: 0,
      max: 100,
      step: 5,
    });
    expect(endBox(column('rate', { type: 'range' }))).toEqual({ type: 'number', inputmode: 'decimal', min: undefined, max: undefined, step: undefined });
  });
});
