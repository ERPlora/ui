// A table that fills its page gives its rows all the room down to the pager. When they do not all fit, the last one
// on screen is cut at the pager and the rest scroll in: a box shortened to whole rows left an empty band of up to a
// row's height, and the row under it looked like it was not there.
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

/** The rows' box `room` px tall; the header row (index 0) and the data rows `height(index)` px tall. */
function layOut(t: ReturnType<typeof mountTable>, room: number, height: (index: number) => number): void {
  const scroll = t.element.querySelector('.data-table__scroll') as HTMLElement;
  Object.defineProperty(scroll, 'clientHeight', { configurable: true, get: () => room });
  [...scroll.querySelectorAll<HTMLElement>('.data-table__row')].forEach((row, index) => {
    Object.defineProperty(row, 'offsetHeight', { configurable: true, get: () => height(index) });
  });
}

/** What the table wrote on its rows' box to make it shorter than the room it has, if anything. */
const cap = (t: ReturnType<typeof mountTable>): string => {
  const scroll = t.element.querySelector('.data-table__scroll') as HTMLElement;
  return `${scroll.style.maxHeight}${scroll.style.height}`;
};
const people = Array.from({ length: 4 }, (_, i) => ({ id: String(i), name: `Person ${i}` }));

describe('the rows of a filled table reach the pager', () => {
  it('four rows 5 px taller than the room: the box keeps the room, the fourth row shows and scrolls', async () => {
    const t = mountTable({ rows: people, columns: [{ key: 'name', label: 'Name' }], fill: true, views: ['table', 'cards'] });
    await settle();
    // Header 35, then four rows of 80: 355 px in a room of 350.
    layOut(t, 350, (index) => (index === 0 ? 35 : 80));
    observers.fire();
    expect(cap(t), 'measured after a resize').toBe('');
    window.dispatchEvent(new Event('resize'));
    expect(cap(t), 'measured after the window resized').toBe('');
  });

  it('also after the list was swapped for the cards and back', async () => {
    const t = mountTable({ rows: people, columns: [{ key: 'name', label: 'Name' }], fill: true, views: ['table', 'cards'] });
    await settle();
    const segment = t.element.querySelector('.data-table__view-segment') as HTMLElement;
    await ionChange(segment, { value: 'cards' });
    await ionChange(segment, { value: 'table' });
    await settle();
    layOut(t, 300, (index) => (index === 0 ? 40 : 80));
    observers.fire();
    expect(cap(t)).toBe('');
  });
});
