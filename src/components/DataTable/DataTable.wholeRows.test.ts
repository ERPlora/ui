// A table that fills its page never leaves a row cut at the pager: its rows' box ends after the last whole row,
// measured again whenever a row changes height (a note that wraps, a control that hydrates late).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ionChange, mockResizeObserver, mountTable, settle, viewport } from './__tests__/harness';

let observers: { fire: () => void };

beforeEach(() => {
  viewport(false);
  observers = mockResizeObserver();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

/** Every row `height` px tall, in a box `room` px tall. */
/** The header row `index` 0, then the data rows. */
function layOut(t: ReturnType<typeof mountTable>, room: number, height: (index: number) => number): void {
  const scroll = t.element.querySelector('.data-table__scroll') as HTMLElement;
  Object.defineProperty(scroll, 'clientHeight', { configurable: true, get: () => room });
  [...scroll.querySelectorAll<HTMLElement>('.data-table__row')].forEach((row, index) => {
    Object.defineProperty(row, 'offsetHeight', { configurable: true, get: () => height(index) });
  });
}
const cap = (t: ReturnType<typeof mountTable>) => (t.element.querySelector('.data-table__scroll') as HTMLElement).style.maxHeight;
const rows = Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: `Row ${i}` }));

describe('no row cut at the pager', () => {
  it('a row that grows after the table measured moves the end of the box', async () => {
    const t = mountTable({ rows, columns: [{ key: 'name', label: 'Name' }], fill: true, views: ['table', 'cards'] });
    await settle();
    let grown = false;
    // Header 40, then rows of 80: three whole ones fit in 300.
    layOut(t, 300, (index) => (index === 0 ? 40 : grown && index === 3 ? 140 : 80));
    observers.fire();
    expect(cap(t)).toBe('280px');
    grown = true;
    observers.fire();
    expect(cap(t), 'the third row grew past the box: two whole rows').toBe('200px');
  });

  it('also after the list was swapped for the cards and back: the box measured is the one on screen', async () => {
    const t = mountTable({ rows, columns: [{ key: 'name', label: 'Name' }], fill: true, views: ['table', 'cards'] });
    await settle();
    observers.fire();
    const segment = t.element.querySelector('.data-table__view-segment') as HTMLElement;
    await ionChange(segment, { value: 'cards' });
    await ionChange(segment, { value: 'table' });
    await settle();
    layOut(t, 300, (index) => (index === 0 ? 40 : 80));
    observers.fire();
    expect(cap(t)).toBe('280px');
  });
});
