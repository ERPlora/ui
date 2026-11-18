// The cards grow at the end of their scroll at any width, as a phone's rows do; the list keeps its pager.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cards, crossBreakpoint, ionChange, mountTable, settle, text, viewport } from './__tests__/harness';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

type Table = ReturnType<typeof mountTable>;
const NAME = [{ key: 'name', label: 'Name' }];
const rowsOf = (n: number, offset = 0) => Array.from({ length: n }, (_, i) => ({ id: String(offset + i + 1), name: `Servicio ${offset + i + 1}` }));
const info = (t: Table) => text(t.element.querySelector('.data-table__pager-info'));
const infinite = (t: Table) => t.element.querySelector('ion-infinite-scroll') as (HTMLElement & { disabled?: boolean }) | null;
const pageButtons = (t: Table) => t.element.querySelectorAll('.data-table__pager-nav .data-table__page');
const segment = (t: Table) => t.element.querySelector('.data-table__view-segment') as HTMLElement;
async function scrollToEnd(t: Table): Promise<void> {
  infinite(t)?.dispatchEvent(new CustomEvent('ionInfinite', { bubbles: true }));
  await settle();
}
const cardsOf = (extra: Record<string, unknown> = {}) =>
  mountTable({ rows: rowsOf(25), columns: NAME, views: ['table', 'cards'], defaultView: 'cards', ...extra });

describe('desk cards load the next ones at the end of the scroll', () => {
  it('client: one page of cards, then one more at each end, without a numbered pager', async () => {
    const t = cardsOf();
    await settle();
    expect(cards(t)).toHaveLength(10);
    expect(pageButtons(t)).toHaveLength(0);
    await scrollToEnd(t);
    expect(cards(t)).toHaveLength(20);
    expect(info(t)).toBe('Showing 1–20 of 25 records');
    await scrollToEnd(t);
    expect(cards(t)).toHaveLength(25);
    expect(infinite(t)?.disabled).toBe(true);
    expect(info(t)).toBe('25 records');
  });

  it('the indicator sits after the last card, inside the cards', async () => {
    const t = cardsOf();
    await settle();
    expect(infinite(t)?.parentElement?.classList.contains('data-table__cards')).toBe(true);
  });

  it('the list picked again keeps its numbered pager and no infinite scroll', async () => {
    const t = cardsOf();
    await settle();
    await ionChange(segment(t), { value: 'table' });
    expect(infinite(t)).toBeNull();
    expect(pageButtons(t).length).toBeGreaterThan(1);
  });

  it('server: asks the parent to grow the window (loadMore), as a phone does', async () => {
    const t = cardsOf({ serverSide: true, rows: rowsOf(10), total: 120, page: 0 });
    await settle();
    await scrollToEnd(t);
    expect(t.emitted('loadMore')).toEqual([[]]);
    expect(t.emitted('pageChange')).toBeUndefined();
  });

  it('server: turning a later page of the list into cards, or grown cards into the list, starts from the first page', async () => {
    const t = mountTable({ serverSide: true, rows: rowsOf(10, 20), total: 120, page: 2, columns: NAME, views: ['table', 'cards'] });
    await settle();
    await ionChange(segment(t), { value: 'cards' });
    expect(t.emitted('pageChange')).toEqual([[0]]);
    await t.setProps({ page: 0, rows: rowsOf(20) });
    await settle();
    await ionChange(segment(t), { value: 'table' });
    expect(t.emitted('pageChange')).toEqual([[0], [0]]);
  });
});

describe('the scroll the indicator listens to', () => {
  it('a desk table that fills its page scrolls its cards itself: they are Ionic’s scroll host', async () => {
    const t = cardsOf({ fill: true });
    await settle();
    expect(t.element.querySelector('.data-table__cards')?.classList.contains('ion-content-scroll-host')).toBe(true);
  });

  it('otherwise the page scrolls: the cards are no host and Ionic finds the page’s content', async () => {
    const plain = cardsOf();
    viewport(true);
    const phone = cardsOf({ fill: true });
    await settle();
    expect(plain.element.querySelector('.data-table__cards')?.classList.contains('ion-content-scroll-host')).toBe(false);
    expect(phone.element.querySelector('.data-table__cards')?.classList.contains('ion-content-scroll-host')).toBe(false);
  });

  it('crossing the breakpoint gives the indicator its new scroll: it is a new element', async () => {
    const t = cardsOf({ fill: true });
    await settle();
    const before = infinite(t);
    crossBreakpoint(true);
    await settle();
    expect(infinite(t)).not.toBe(before);
  });
});
