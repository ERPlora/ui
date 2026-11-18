import type { DataTableColumn } from './types';

/** A column sized by its content, as the ladder reads it. */
export type LadderColumn = Pick<DataTableColumn<never>, 'key' | 'identity' | 'priority' | 'minWidth'>;

/** How each step of the ladder is tried: 1, as it is (nothing asks for more than its floor); 2, whole and then cut;
 *  3, whole, cut, and cut with the name at the common floor, when the column asking for more is a name that keeps
 *  10rem when cut. The name gives that up before the ladder's next step: hiding a column, folding the actions, the
 *  cards. PURE. */
export function ladderPhases(columns: readonly LadderColumn[], needs: Readonly<Record<string, number>>): 1 | 2 | 3 {
  const asking = columns.filter((column) => (needs[column.key] ?? 0) > 0);
  if (asking.length === 0) return 1;
  return asking.some((column) => !column.minWidth && (!!column.identity || column.priority === 'high')) ? 3 : 2;
}

/** A rung of the ladder: how many of its steps are given up (`base`) and whether the columns may cut their text
 *  (`clipped`; `'tight'`: the name down to the common floor too). PURE. */
export function ladderRung(level: number, phases: number): { base: number; clipped: boolean | 'tight' } {
  const clipped = ([false, true, 'tight'] as const)[level % phases];
  return { base: Math.floor(level / phases), clipped };
}

/** The top rung of a ladder of `steps` steps (see `ladderRung`). */
export function ladderLength(steps: number, phases: number): number {
  return phases * steps + phases - 1;
}
