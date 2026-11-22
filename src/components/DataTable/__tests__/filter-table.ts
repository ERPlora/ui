// The table the DataTable filter tests share (its columns, its rows and how to read them back) and what a
// person does in one of its filter controls.
import { pickIn } from '../../DateTimeField/__tests__/pickers';
import { byTestId, dataRows, mountTable, settle } from './harness';

type Row = Record<string, unknown>;

const STATUS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
export const COLUMNS = [
  { key: 'name', label: 'Name', filter: { type: 'text' } },
  { key: 'status', label: 'Status', filter: { type: 'select', options: STATUS } },
  { key: 'rate', label: 'Rate', filter: { type: 'range' } },
  { key: 'day', label: 'Day', filter: { type: 'date' } },
  { key: 'note', label: 'Note' },
];
export const ROWS: Row[] = [
  { id: '1', name: 'Ana García', status: 'active', rate: 21, day: '2026-10-14', note: 'x' },
  { id: '2', name: 'Luis Ana', status: 'inactive', rate: 10, day: '2026-10-13', note: 'y' },
  { id: '3', name: 'Marta', status: 'active', rate: 4, day: '2026-10-14', note: 'z' },
];

export const base = { rows: ROWS, columns: COLUMNS, testid: 'rules', pageSizeOptions: [] };
export const ids = (t: ReturnType<typeof mountTable>) => dataRows(t).map((row) => row.getAttribute('data-id'));
export const control = (t: ReturnType<typeof mountTable>, name: string) => byTestId(t, `rules-filter-${name}`)[0] as HTMLElement & { value?: unknown };

/** What Ionic sends while the person types in an ion-input (debounced by Ionic itself). */
export async function typeIn(el: HTMLElement, value: string): Promise<void> {
  el.dispatchEvent(new CustomEvent('ionInput', { detail: { value } }));
  await settle();
}
/** What Ionic sends when a select commits a value. */
export async function change(el: HTMLElement, value: unknown): Promise<void> {
  el.dispatchEvent(new CustomEvent('ionChange', { detail: { value } }));
  await settle();
}
/** A day picked in a date filter's calendar ('' as Clear). */
export async function pick(t: ReturnType<typeof mountTable>, name: string, value: string): Promise<void> {
  await pickIn(t, `rules-filter-${name}`, value);
}
