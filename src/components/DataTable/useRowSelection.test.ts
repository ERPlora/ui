import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useRowSelection } from './useRowSelection';

type Row = { id: string };
const rows: Row[] = [{ id: 'a' }, { id: 'b' }];

function setup(selected?: string[]) {
  const given = ref<string[] | undefined>(selected);
  const emit = vi.fn();
  const s = useRowSelection<Row>({ selected: () => given.value, visible: () => rows, keyOf: (row) => row.id, emit });
  return { ...s, given, emit };
}

describe('useRowSelection', () => {
  it('keeps its own selection when none is given, and says each change', () => {
    const s = setup();
    s.toggleRow('a');
    expect([...s.selection.value]).toEqual(['a']);
    s.toggleRow('a');
    expect([...s.selection.value]).toEqual([]);
    expect(s.emit.mock.calls).toEqual([[['a']], [[]]]);
  });

  it('a given selection (`v-model:selected`) is the parent’s: only emitted', () => {
    const s = setup(['b']);
    s.toggleRow('a');
    expect([...s.selection.value]).toEqual(['b']);
    expect(s.emit).toHaveBeenCalledWith(['b', 'a']);
  });

  it('all on screen: selects every visible row, and clears them when all were', () => {
    const s = setup();
    expect(s.allSelected.value).toBe(false);
    s.toggleAll();
    expect(s.allSelected.value).toBe(true);
    s.toggleAll();
    expect(s.selection.value.size).toBe(0);
  });

  it('clears at once', () => {
    const s = setup();
    s.toggleAll();
    s.setSelection(new Set());
    expect(s.selection.value.size).toBe(0);
  });
});
