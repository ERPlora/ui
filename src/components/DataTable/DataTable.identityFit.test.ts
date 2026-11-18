// The name column prefers 10rem when the row has to cut, but gives it up (down to the common 5.5rem floor) before
// the list hides a low column, folds its row actions into «⋮» or hands over to the cards. happy-dom lays nothing out:
// a fake engine sizes the row from the minimum of each track of its template.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockResizeObserver, mountTable, settle, text, viewport } from './__tests__/harness';

type Table = ReturnType<typeof mountTable>;

const PAD = 32;
const BUTTON = 40;
const CHAR = 8;
const REM = 16;
const NAME = 'Croquetas caseras de jamón'; // 26 characters: 208px of text, a 209px column

let box = 900;

/** The minimum a track of the head's template takes, in px. */
function trackMin(track: string, scroll: Element): number {
  const cut = track.match(/^minmax\(min\(([\d.]+)rem,(\d+)px\),\d+px\)$/);
  if (cut) return Math.min(Number(cut[1]) * REM, Number(cut[2]));
  const whole = track.match(/^minmax\((\d+)px,[\d.]+fr\)$/);
  if (whole) return Number(whole[1]);
  const floor = track.match(/^minmax\(([\d.]+)rem,/);
  if (floor) return Number(floor[1]) * REM;
  const px = track.match(/^(\d+)px$/);
  if (px) return Number(px[1]);
  if (track === 'max-content') {
    let buttons = 0;
    for (const cell of scroll.querySelectorAll('.data-table__row--data .data-table__actions')) {
      buttons = Math.max(buttons, [...cell.children].filter((el) => el.tagName === 'ION-BUTTON').length);
    }
    return buttons * BUTTON;
  }
  throw new Error(`the fake engine does not size «${track}»`);
}

function playBackLayout(): void {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
    return this.classList.contains('data-table') || this.classList.contains('data-table__scroll') ? box : 0;
  });
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    if (this.classList.contains('data-table__scroll')) {
      const head = this.querySelector<HTMLElement>('.data-table__row--head');
      const tracks = (head?.style.gridTemplateColumns ?? '').split(' ').filter(Boolean);
      return Math.max(PAD + tracks.reduce((sum, track) => sum + trackMin(track, this), 0), box);
    }
    if (this.tagName === 'SPAN' && this.parentElement?.matches('.data-table__cell:not(.data-table__cell--actions)')) {
      return (this.textContent?.trim().length ?? 0) * CHAR;
    }
    return 0;
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({ width: BUTTON, height: BUTTON, top: 0, left: 0, right: BUTTON, bottom: BUTTON, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect,
  );
}

let observers: { fire: () => void };

beforeEach(() => {
  viewport(false);
  box = 900;
  observers = mockResizeObserver();
  playBackLayout();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

const NAME_COLUMN = { key: 'name', label: 'Name', priority: 'high' };
const PLAIN = [
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total' },
  { key: 'plan', label: 'Plan' },
];
const LOW = [
  { key: 'status', label: 'Status' },
  { key: 'total', label: 'Total' },
  { key: 'note', label: 'Note', priority: 'low' },
];
const ROWS = [{ id: 'p1', name: NAME, status: 'Active', total: '€1.00', plan: 'Pro', note: 'Gift' }];
const ACTIONS = [
  { id: 'edit', label: 'Edit', icon: 'create-outline' },
  { id: 'stock', label: 'Receive stock', icon: 'download-outline' },
];

async function mountAt(width: number, props: Record<string, unknown>): Promise<Table> {
  box = width;
  const t = mountTable({ rows: ROWS, testid: 'p', ...props });
  await settle();
  return t;
}

const nameTrack = (t: Table) => (t.element.querySelector('.data-table__row--head') as HTMLElement).style.gridTemplateColumns.split(' ')[0];
const headers = (t: Table) =>
  [...t.element.querySelectorAll('.data-table__row--head .data-table__cell--header:not(.data-table__cell--actions)')].map((h) => text(h));
const rowButtons = (t: Table) =>
  [...t.element.querySelectorAll('.data-table__row--data .data-table__actions > ion-button')].map((b) =>
    (b.getAttribute('data-testid') ?? '').replace(/^p-row-[^-]+-/, ''),
  );
const isCards = (t: Table) => !!t.element.querySelector('.data-table__cards');

describe('the name column gives up its 10rem before the list gives up anything else', () => {
  // Whole 585 · name cut at 10rem 536 · name at 5.5rem 464 · without Note (whole) 497.
  it('with a tight box the name goes below 10rem and the low column stays', async () => {
    const t = await mountAt(500, { columns: [NAME_COLUMN, ...LOW], actions: ACTIONS, views: false });
    expect(headers(t)).toEqual(['Name', 'Status', 'Total', 'Note']);
    expect(nameTrack(t)).toBe('minmax(5.5rem,209px)');
  });

  // Whole 585 · name cut at 10rem 536 · name at 5.5rem 464 · folded, name cut at 10rem 496.
  it('the row actions stay out of «⋮» while the name can still give up width', async () => {
    const t = await mountAt(500, { columns: [NAME_COLUMN, ...PLAIN], actions: ACTIONS, views: false });
    expect(rowButtons(t)).toEqual(['edit', 'stock']);
    expect(nameTrack(t)).toBe('minmax(5.5rem,209px)');
  });

  // Folded into «⋮»: whole 545 · name cut at 10rem 496 · name at 5.5rem 424.
  it('the list does not hand over to the cards while it fits with the name at its floor', async () => {
    const t = await mountAt(430, { columns: [NAME_COLUMN, ...PLAIN], actions: ACTIONS, views: ['table', 'cards'] });
    expect(isCards(t)).toBe(false);
    expect(rowButtons(t)).toEqual(['menu']);
    expect(nameTrack(t)).toBe('minmax(5.5rem,209px)');
  });

  it('with room for it the cut name keeps its 10rem', async () => {
    const t = await mountAt(540, { columns: [NAME_COLUMN, ...LOW], actions: ACTIONS, views: false });
    expect(headers(t)).toEqual(['Name', 'Status', 'Total', 'Note']);
    expect(nameTrack(t)).toBe('minmax(min(10rem,209px),209px)');
  });

  it('when not even the name at its floor fits, the ladder goes on as before: the low column goes first', async () => {
    const t = await mountAt(460, { columns: [NAME_COLUMN, ...LOW], actions: ACTIONS, views: false });
    expect(headers(t)).toEqual(['Name', 'Status', 'Total']);
    expect(rowButtons(t)).toEqual(['edit', 'stock']);
  });

  it('a box that widens again gives the name its 10rem back', async () => {
    const t = await mountAt(500, { columns: [NAME_COLUMN, ...LOW], actions: ACTIONS, views: false });
    box = 540;
    observers.fire();
    await settle();
    expect(nameTrack(t)).toBe('minmax(min(10rem,209px),209px)');
  });
});
