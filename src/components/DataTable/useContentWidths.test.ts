// happy-dom lays nothing out: each header and cell holds one text as wide as the test says.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Ref } from 'vue';

import { useContentWidths } from './useContentWidths';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.style.fontSize = '';
  document.body.replaceChildren();
});

/** A cell with a text `width` px wide on one line. */
function cell(role: 'columnheader' | 'cell', width: number): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('role', role);
  const text = document.createElement('span');
  text.getBoundingClientRect = () => ({ width }) as DOMRect;
  el.append(text);
  return el;
}

function row(kind: 'head' | 'data', widths: number[]): HTMLElement {
  const el = document.createElement('div');
  el.className = `data-table__row data-table__row--${kind}`;
  el.append(...widths.map((width) => cell(kind === 'head' ? 'columnheader' : 'cell', width)));
  return el;
}

/** The list with its head and its rows, `boxWidth` px wide. */
function list(head: number[], rows: number[][], boxWidth = 900): HTMLElement {
  const scroll = document.createElement('div');
  Object.defineProperty(scroll, 'clientWidth', { get: () => boxWidth });
  const grid = document.createElement('div');
  grid.className = 'data-table__grid';
  grid.append(row('head', head), ...rows.map((widths) => row('data', widths)));
  scroll.append(grid);
  // Styles are only computed for an element in the document.
  document.body.replaceChildren(scroll);
  return scroll;
}

function measuring(first: HTMLElement | null, keys: (string | null)[]) {
  const on = { scroll: first, keys, rows: 'r1' };
  const written: Ref<unknown>[] = [];
  const widths = useContentWidths({
    scroll: () => on.scroll,
    columnKeys: () => on.keys,
    rowsKey: () => on.rows,
    write: (target, value) => {
      if (target.value === value) return;
      target.value = value;
      written.push(target);
    },
  });
  return { on, written, ...widths };
}

describe('useContentWidths: what each column sized by its content takes on one line', () => {
  it('the widest of its header and its rows: what it asks beyond the common floor, or what it leaves free of it', () => {
    const list_ = measuring(list([93, 50, 30], [[60, 227, 48], [61, 40, 30]]), ['staff', 'repeats', 'ends']);
    expect(list_.measure()).toBe(true);
    expect(list_.contentWidths.value).toEqual({ staff: 94, repeats: 228, ends: 0 });
    expect(list_.spareWidths.value).toEqual({ staff: 0, repeats: 0, ends: 39 });
  });

  it('a column with its own width is never measured', () => {
    const list_ = measuring(list([93, 50], [[60, 227]]), ['staff', null]);
    list_.measure();
    expect([list_.contentWidths.value, list_.spareWidths.value]).toEqual([{ staff: 94 }, { staff: 0 }]);
    const own = measuring(list([93], [[60]]), [null]);
    expect([own.measure(), own.contentWidths.value]).toEqual([false, {}]);
  });

  it('nothing is measured without a list, before it has its width or while it paints other columns', () => {
    expect(measuring(null, ['staff']).measure()).toBe(false);
    expect(measuring(list([93], [[60]], 0), ['staff']).measure()).toBe(false);
    const painting = measuring(list([93, 50], [[60, 40]]), ['staff']);
    expect([painting.measure(), painting.contentWidths.value, painting.spareWidths.value]).toEqual([false, {}, {}]);
  });

  it('the floor follows the size of the text of the page, which the tracks are told', () => {
    document.documentElement.style.fontSize = '20px';
    const list_ = measuring(list([93], [[100]]), ['staff']);
    list_.measure();
    expect([list_.rem.value, list_.contentWidths.value, list_.spareWidths.value]).toEqual([20, { staff: 0 }, { staff: 9 }]);
  });

  it('measured again the same: nothing is written', () => {
    const list_ = measuring(list([93, 50], [[60, 40]]), ['staff', 'ends']);
    list_.measure();
    list_.written.length = 0;
    expect(list_.measure()).toBe(false);
    expect(list_.written).toEqual([]);
  });

  it('a short text that changes changes what its column lends, and nobody’s need: the box is not judged again', () => {
    const list_ = measuring(list([93, 50], [[60, 40]]), ['staff', 'ends']);
    list_.measure();
    const needs = list_.contentWidths.value;
    list_.on.scroll = list([93, 50], [[60, 51]]);
    expect(list_.measure()).toBe(false);
    expect(list_.contentWidths.value).toBe(needs);
    expect(list_.spareWidths.value, 'a pixel counts: the text would be cut').toEqual({ staff: 0, ends: 36 });
  });

  it('with the same rows a need only grows; other rows are measured afresh', () => {
    const list_ = measuring(list([50], [[120]]), ['email']);
    list_.measure();
    list_.on.scroll = list([50], [[60]]);
    expect([list_.measure(), list_.contentWidths.value]).toEqual([false, { email: 121 }]);
    list_.on.rows = 'r2';
    expect([list_.measure(), list_.contentWidths.value]).toEqual([true, { email: 0 }]);
    expect(list_.spareWidths.value).toEqual({ email: 27 });
  });

  it('a column the box hides keeps what it asked and what it left free', () => {
    const list_ = measuring(list([93, 50], [[60, 40]]), ['staff', 'ends']);
    list_.measure();
    list_.on.scroll = list([93], [[60]]);
    list_.on.keys = ['staff'];
    expect(list_.measure()).toBe(false);
    expect([list_.contentWidths.value, list_.spareWidths.value]).toEqual([{ staff: 94, ends: 0 }, { staff: 0, ends: 37 }]);
  });
});
