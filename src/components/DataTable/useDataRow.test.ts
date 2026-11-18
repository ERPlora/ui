import { describe, expect, it, vi } from 'vitest';
import { nextTick, reactive } from 'vue';

import type { DataTableColumn } from './types';
import { DATA_ROW_DEFAULTS, useDataRow } from './useDataRow';

type Row = { id: string; name: string };
const NAME: DataTableColumn<Row> = { key: 'name', label: 'Name' };
const ANA: Row = { id: '1', name: 'Ana' };

function dataRow(clickable: boolean) {
  const props = reactive({ row: ANA, rows: [ANA] as Row[] | undefined, rowId: '1', clickable });
  const onOpen = vi.fn();
  return { props, onOpen, ...useDataRow<Row>(props, onOpen) };
}

/** A tap on the text of the name: a text of 380px shown in 90px when clipped, of 90px when it fits. */
function tapName(row: ReturnType<typeof dataRow>, pointerType: 'touch' | 'mouse', clipped = true): void {
  const span = document.createElement('span');
  Object.defineProperty(span, 'scrollWidth', { get: () => (clipped ? 380 : 90) });
  Object.defineProperty(span, 'clientWidth', { get: () => 90 });
  span.addEventListener('pointerdown', (event) => row.onPointerdown(event));
  span.addEventListener('click', (event) => row.onCellTap(event, NAME));
  span.dispatchEvent(new PointerEvent('pointerdown', { pointerType }));
  span.dispatchEvent(new MouseEvent('click'));
}

const key = (name: string) => new KeyboardEvent('keydown', { key: name, cancelable: true });

describe('useDataRow', () => {
  it('a clickable row opens on a click, Enter or Space, and the key does nothing else', () => {
    const row = dataRow(true);
    row.open();
    const enter = key('Enter');
    row.onKeydown(enter);
    row.onKeydown(key(' '));
    row.onKeydown(key('a'));
    expect(row.onOpen).toHaveBeenCalledTimes(3);
    expect(row.onOpen).toHaveBeenCalledWith(ANA);
    expect(enter.defaultPrevented).toBe(true);
  });

  it('a row that is not clickable never opens and leaves its keys alone', () => {
    const row = dataRow(false);
    row.open();
    const enter = key('Enter');
    row.onKeydown(enter);
    expect(row.onOpen).not.toHaveBeenCalled();
    expect(enter.defaultPrevented).toBe(false);
  });

  it('a touch on a clipped text unfolds it; a mouse, a text that fits or a row that opens leave it', () => {
    const touched = dataRow(false);
    tapName(touched, 'touch');
    expect(touched.isUnfolded(NAME)).toBe(true);
    for (const [row, pointer, clipped] of [[dataRow(false), 'mouse', true], [dataRow(false), 'touch', false], [dataRow(true), 'touch', true]] as const) {
      tapName(row, pointer, clipped);
      expect(row.isUnfolded(NAME)).toBe(false);
    }
  });

  it('another row or another page folds its texts back', async () => {
    const row = dataRow(false);
    tapName(row, 'touch');
    row.props.row = { ...ANA };
    await nextTick();
    expect(row.isUnfolded(NAME)).toBe(false);
    tapName(row, 'touch');
    row.props.rows = [{ ...ANA }];
    await nextTick();
    expect(row.isUnfolded(NAME)).toBe(false);
  });

  it('reads the value under the column key, and names its controls in English by default', () => {
    expect(dataRow(false).valueOf(NAME)).toBe('Ana');
    expect(DATA_ROW_DEFAULTS).toMatchObject({ selectLabel: 'Select', moreLabel: 'More actions', selectable: false, clickable: false });
  });
});
