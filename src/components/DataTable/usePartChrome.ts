import { ionIconSrc } from '../../shell/icons';
import { useDataTableLabels } from './labels';
import { DATA_TABLE_ICONS } from './model';
import type { DataTableLabels } from './types';

/** What a part of the table (its footer, its filters panel) paints its chrome with: the table's icons, its
 *  texts with the page's `labels` first, and the `data-testid` hooks under the table's prefix. Call from `setup`. */
export function usePartChrome(props: { labels?: Partial<DataTableLabels>; testid?: string }) {
  const { text: label } = useDataTableLabels(() => props.labels);
  const tid = (suffix: string): string | undefined => (props.testid ? `${props.testid}-${suffix}` : undefined);
  return { ICONS: DATA_TABLE_ICONS, icon: ionIconSrc, label, tid };
}
