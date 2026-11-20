import { computed, ref, watch } from 'vue';

import type { LabelParams } from './labels';
import { filterKeys } from './model';
import type { DataTableColumn, DataTableFilterOption, DataTableLabelKey } from './types';

/** The box of a range's end: days for a date range; for a range, numbers within its bounds, or an
 *  amount as typed (a text box with the decimal keyboard: `2,50`). */
function endBox<T>(column: DataTableColumn<T>): Record<string, string | number | undefined> {
  const filter = column.filter;
  if (filter?.type === 'daterange') return { type: 'date' };
  if (filter?.type === 'range' && filter.amount) return { type: 'text', inputmode: 'decimal' };
  return {
    type: 'number',
    inputmode: 'decimal',
    min: filter?.type === 'range' ? filter.min : undefined,
    max: filter?.type === 'range' ? filter.max : undefined,
    step: filter?.type === 'range' ? filter.step : undefined,
  };
}

/** What a column filter's control paints besides its value, in the filter row and in the filters panel:
 *  its name, its choices, the boxes of a range's ends, the label of the value a lookup holds, and what the
 *  server refused (`filterErrors`) until that value changes. */
export function useFilterControls<T extends object>(source: {
  filterErrors: () => Record<string, string> | undefined;
  label: (key: DataTableLabelKey, params?: LabelParams) => string;
}) {
  const label = source.label;
  /** The name of a column's (single) filter in `filters`. */
  const filterName = (column: DataTableColumn<T>): string => filterKeys(column)[0] ?? column.key;

  /** Filter names whose value changed since the last `filterErrors`: their message is gone. */
  const answeredErrors = ref(new Set<string>());
  watch(
    source.filterErrors,
    () => {
      answeredErrors.value = new Set();
    },
    { deep: true },
  );
  /** The message under a filter's control, until its value changes. */
  function errorOf(name: string): string | undefined {
    return answeredErrors.value.has(name) ? undefined : source.filterErrors()?.[name]?.trim() || undefined;
  }
  /** Ionic paints `error-text` only on a control marked invalid and touched. */
  const invalidMark = (name: string) => ({ 'ion-invalid': !!errorOf(name), 'ion-touched': !!errorOf(name) });
  const refused = computed(() => Object.keys(source.filterErrors() ?? {}).some((name) => !!errorOf(name)));
  function answerError(name: string): void {
    if (source.filterErrors()?.[name] && !answeredErrors.value.has(name)) answeredErrors.value = new Set(answeredErrors.value).add(name);
  }
  /** A yes/no's choices, after «All». */
  const YES_NO = computed<DataTableFilterOption[]>(() => [
    { value: 'true', label: label('filterYes') },
    { value: 'false', label: label('filterNo') },
  ]);
  const choicesOf = (column: DataTableColumn<T>): DataTableFilterOption[] =>
    column.filter?.type === 'boolean' ? YES_NO.value : column.filter?.type === 'select' ? (column.filter.options ?? []) : [];
  /** The label of the value a lookup holds: the one picked here, else the page's `selected`, else none. */
  const lookupPicks = ref<Record<string, DataTableFilterOption>>({});
  function lookupLabel(column: DataTableColumn<T>, value: string | undefined): string | undefined {
    if (!value || column.filter?.type !== 'lookup') return undefined;
    const picked = lookupPicks.value[filterName(column)];
    if (picked?.value === value) return picked.label;
    return column.filter.selected?.value === value ? column.filter.selected.label : undefined;
  }
  function rememberPick(name: string, value: string, text: string): void {
    if (value) lookupPicks.value = { ...lookupPicks.value, [name]: { value, label: text } };
  }
  /** A range's two ends: their names, their hints and their accessible names. */
  function rangeEnds(column: DataTableColumn<T>): Array<{ name: string; hint: string; named: string }> {
    const [from, to] = filterKeys(column);
    return [
      { name: from, hint: label('filterFrom'), named: label('filterFromOf', { label: column.label }) },
      { name: to, hint: label('filterTo'), named: label('filterToOf', { label: column.label }) },
    ];
  }

  return { filterName, errorOf, invalidMark, refused, answerError, choicesOf, lookupLabel, rememberPick, endBox, rangeEnds };
}

/** One table's filter controls state, handed to the parts that paint its filters. */
export type FilterControls<T extends object> = ReturnType<typeof useFilterControls<T>>;
