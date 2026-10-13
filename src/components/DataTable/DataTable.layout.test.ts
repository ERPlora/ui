// DataTable layout with the browser's measurements played back (happy-dom lays nothing out):
// horizontal overflow (#67), phone cards and the view switch (#274, #247, #76), the hand-over to
// cards when the list does not fit even folded (#267) and `fill` with content after it (#218).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cards, crossBreakpoint, dataRows, ionChange, mountTable, settle, text, viewport } from './__tests__/harness';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const NAME = [{ key: 'name', label: 'Name' }];
const ROWS = [{ id: 1, name: 'Corte' }, { id: 2, name: 'Barba' }];
const isCards = (t: ReturnType<typeof mountTable>) => !!t.element.querySelector('.data-table__cards');

describe('the list says when it overflows sideways (#67)', () => {
  const scroll = (t: ReturnType<typeof mountTable>) => t.element.querySelector('.data-table__scroll') as HTMLElement;

  it('only when it does not fit, measured on resize', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, actions: [{ id: 'open', label: 'Open' }] });
    await settle();
    expect(scroll(t).classList.contains('data-table__scroll--overflow')).toBe(false);
    Object.defineProperty(scroll(t), 'scrollWidth', { configurable: true, value: 1860 });
    Object.defineProperty(scroll(t), 'clientWidth', { configurable: true, value: 1440 });
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(scroll(t).classList.contains('data-table__scroll--overflow')).toBe(true);
  });

  it('even when the width arrives AFTER the render (Ionic hydrating): the scroller is observed', async () => {
    const callbacks: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          callbacks.push(cb);
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    const t = mountTable({ rows: ROWS, columns: NAME });
    await settle();
    expect(callbacks).not.toHaveLength(0);
    Object.defineProperty(scroll(t), 'scrollWidth', { configurable: true, value: 1791 });
    Object.defineProperty(scroll(t), 'clientWidth', { configurable: true, value: 1440 });
    callbacks.forEach((cb) => cb());
    await settle();
    expect(scroll(t).classList.contains('data-table__scroll--overflow')).toBe(true);
  });
});

describe('cards on a phone, and the list/cards switch (#274, #247)', () => {
  // The switch is an ion-segment (Ioan, 2026-10-13): Ionic marks the checked button for assistive
  // tech (`aria-selected`) from the segment's value.
  const segment = (t: ReturnType<typeof mountTable>) => t.element.querySelector('.data-table__view-segment') as HTMLElement & { value?: string };
  const toggles = (t: ReturnType<typeof mountTable>) => [...segment(t).querySelectorAll('ion-segment-button')] as HTMLElement[];
  const pick = (t: ReturnType<typeof mountTable>, view: 'table' | 'cards') => ionChange(segment(t), { value: view });

  it('a phone starts in cards when cards are declared; a desk starts as a list', async () => {
    viewport(true);
    const phone = mountTable({ rows: ROWS, columns: NAME, views: true });
    viewport(false);
    const desk = mountTable({ rows: ROWS, columns: NAME, views: true });
    viewport(true);
    const noCards = mountTable({ rows: ROWS, columns: NAME });
    await settle();
    expect(isCards(phone)).toBe(true);
    expect(isCards(desk)).toBe(false);
    expect(isCards(noCards), 'without `views` it stays a list, as the Lit original').toBe(false);
  });

  it('crossing the breakpoint switches; the person’s pick then wins', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, views: ['table', 'cards'] });
    await settle();
    crossBreakpoint(true);
    await settle();
    expect(isCards(t)).toBe(true);
    await pick(t, 'table');
    expect(isCards(t)).toBe(false);
    expect(t.emitted('viewChange')).toEqual([['table']]);
    await t.setProps({ rows: [...ROWS] });
    await settle();
    expect(isCards(t)).toBe(false);
  });

  it('the switch shows which view is on, both ways', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, views: ['table', 'cards'], addable: true });
    await settle();
    expect(segment(t).value).toBe('table');
    await pick(t, 'cards');
    expect(isCards(t)).toBe(true);
    expect(segment(t).value).toBe('cards');
    await pick(t, 'table');
    expect(segment(t).value).toBe('table');
  });

  it('a table that starts in cards shows cards; `labels` name each table’s own switch', async () => {
    const t = mountTable({ rows: ROWS, columns: NAME, views: true, defaultView: 'cards', labels: { viewList: 'View periods as list', viewCards: 'View periods as cards' } });
    const es = mountTable({ rows: ROWS, columns: NAME, views: true }, { locale: 'es' });
    await settle();
    expect(segment(t).value).toBe('cards');
    expect(toggles(t).map((b) => b.getAttribute('aria-label'))).toEqual(['View periods as list', 'View periods as cards']);
    expect(toggles(es).map((b) => b.getAttribute('aria-label'))).toEqual(['Vista lista', 'Vista tarjetas']);
  });

  it('a phone toolbar has no column chooser nor rows-per-page; a desk has both (#76)', async () => {
    viewport(true);
    const phone = mountTable({ rows: ROWS, columns: NAME, views: true, addable: true });
    viewport(false);
    const desk = mountTable({ rows: ROWS, columns: NAME, views: true, addable: true });
    await settle();
    expect(phone.find('.data-table__columns-select').exists()).toBe(false);
    expect(phone.find('.data-table__page-size-select').exists()).toBe(false);
    expect(desk.find('.data-table__columns-select').exists()).toBe(true);
    expect(desk.find('.data-table__page-size-select').exists()).toBe(true);
  });

  it('a different `cardBreakpoint` is a different phone', async () => {
    const queries: string[] = [];
    vi.stubGlobal('matchMedia', (query: string) => {
      queries.push(query);
      return { media: query, matches: false, addEventListener: () => {}, removeEventListener: () => {} };
    });
    mountTable({ rows: ROWS, columns: NAME, cardBreakpoint: 900 });
    await settle();
    expect(queries).toContain('(max-width: 900px)');
  });
});

describe('a list that does not fit even folded shows cards (#267)', () => {
  // The cash sessions of cash_register as Chromium measured them: 748px folded, +144px with the
  // four buttons out; a 992px window with the side menu open leaves the table 720px.
  const COLUMNS = ['session', 'opened', 'status', 'opening', 'expected', 'closing', 'difference'].map((key) => ({ key, label: key }));
  const ACTIONS = ['detail', 'movement', 'count', 'close'].map((id) => ({ id, label: id, icon: 'document-text-outline' }));
  const SESSIONS = [
    { id: '1', session: 'S-1', opened: '23:45', status: 'Closed', opening: '100,00 €', expected: '250,50 €', closing: '249,50 €', difference: '-1,00 €' },
    { id: '2', session: 'S-2', opened: '23:50', status: 'Open', opening: '100,00 €', expected: '100,00 €', closing: '', difference: '' },
  ];
  let hole = 720;
  let foldedMin = 748;

  function playBackLayout(): void {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('data-table') || this.classList.contains('data-table__scroll') ? hole : 0;
    });
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
      if (!this.classList.contains('data-table__scroll')) return 0;
      const folded = !!this.querySelector('[aria-haspopup="menu"]') || !this.querySelector('.data-table__cell--actions');
      return Math.max(folded ? foldedMin : foldedMin + 144, hole);
    });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ width: 32, height: 32, top: 0, left: 0, right: 32, bottom: 32, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
    );
  }

  async function relayout(): Promise<void> {
    for (let i = 0; i < 4; i++) {
      window.dispatchEvent(new Event('resize'));
      await settle();
    }
  }

  async function mount(props: Record<string, unknown> = {}) {
    const t = mountTable({ rows: SESSIONS, columns: COLUMNS, actions: ACTIONS, views: true, ...props });
    await settle();
    await relayout();
    return t;
  }

  beforeEach(() => {
    hole = 720;
    foldedMin = 748;
    playBackLayout();
  });

  it('720px hole: cards, so nothing sits under the «…»; every figure is readable', async () => {
    const t = await mount();
    expect(isCards(t)).toBe(true);
    expect(t.find('.data-table__cards').text()).toContain('-1,00 €');
  });

  it('holes where it fits folded (752px, 820px, 1168px) stay a list', async () => {
    for (const w of [752, 820, 1168]) {
      hole = w;
      expect(isCards(await mount()), `${w}px`).toBe(false);
    }
  });

  it('the hole growing brings the list back, also when only the table’s own box changes', async () => {
    const observed: Array<() => void> = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private readonly cb: () => void) {}
        observe(el: Element): void {
          if (el.classList.contains('data-table')) observed.push(() => this.cb());
        }
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    const t = await mount();
    expect(isCards(t)).toBe(true);
    hole = 992;
    for (const fire of observed) fire();
    await settle();
    expect(isCards(t)).toBe(false);
  });

  it('never without cards declared, nor without a pinned column (it only scrolls then)', async () => {
    expect(isCards(await mount({ views: false }))).toBe(false);
    expect(isCards(await mount({ actions: [] }))).toBe(false);
  });

  it('the person choosing the list by hand wins', async () => {
    const t = await mount();
    await ionChange(t.element.querySelector('.data-table__view-segment') as HTMLElement, { value: 'table' });
    await relayout();
    expect(isCards(t)).toBe(false);
  });

  it('the same columns in a new array keep the cards; columns that fit take the list back', async () => {
    const t = await mount();
    await t.setProps({ columns: COLUMNS.map((c) => ({ ...c })) });
    await settle();
    expect(isCards(t)).toBe(true);
    foldedMin = 560;
    await t.setProps({ columns: COLUMNS.slice(0, 5) });
    await relayout();
    expect(isCards(t)).toBe(false);
    expect(dataRows(t)).toHaveLength(2);
  });
});

describe('`fill`: on a phone the list grows with the page when content follows it (#218)', () => {
  it('is marked while an in-flow element follows the table, not for out-of-flow or hidden ones', async () => {
    viewport(true);
    const page = document.createElement('div');
    document.body.appendChild(page);
    const t = mountTable({ rows: ROWS, columns: NAME, views: true, fill: true }, { attachTo: page });
    await settle();
    expect(t.classes()).toContain('data-table--fill');
    expect(t.classes()).not.toContain('data-table--content-after');
    // The page the table lives in (VTU may wrap it in a mount point of its own).
    const parent = t.element.parentElement as HTMLElement;
    const notice = document.createElement('h3');
    parent.appendChild(notice);
    await settle();
    expect(t.classes()).toContain('data-table--content-after');
    notice.style.display = 'none';
    await settle();
    expect(t.classes()).not.toContain('data-table--content-after');
    notice.remove();
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    parent.appendChild(overlay);
    await settle();
    expect(t.classes()).not.toContain('data-table--content-after');
    expect(cards(t)).toHaveLength(2);
    expect(text(t.element)).toContain('Corte');
  });

  it('a table without `fill` is never marked', async () => {
    const page = document.createElement('div');
    document.body.appendChild(page);
    const t = mountTable({ rows: ROWS, columns: NAME }, { attachTo: page });
    (t.element.parentElement as HTMLElement).appendChild(document.createElement('h3'));
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(t.classes()).not.toContain('data-table--content-after');
  });
});
