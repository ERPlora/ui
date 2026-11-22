// The name column prefers 10rem when the row has to cut, but gives it up (down to the common 5.5rem floor) before
// the list hides a low column, folds its row actions into «⋮» or hands over to the cards. happy-dom lays nothing out:
// a fake engine sizes the row from the minimum of each track of its template.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  actionButtonsWidth, cellTextWidth, clearLayout, mountTable, playBackLayout, resize, setBoxWidth, settle,
  templateWidth, text,
} from './__tests__/harness';

type Table = ReturnType<typeof mountTable>;

const PAD = 32;
const BUTTON = 40;
const CHAR = 8;
const REM = 16;
const NAME = 'Croquetas caseras de jamón'; // 26 characters: 208px of text, a 209px column

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
  if (track === 'max-content') return actionButtonsWidth(scroll, BUTTON);
  throw new Error(`the fake engine does not size «${track}»`);
}

beforeEach(() => {
  playBackLayout(BUTTON, (el) => {
    if (el.classList.contains('data-table__scroll')) return templateWidth(el, PAD, (track) => trackMin(track, el));
    return cellTextWidth(el, CHAR) ?? 0;
  });
});

afterEach(clearLayout);

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
  setBoxWidth(width);
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

  // A short date in the high column fits the common floor, as does every other column: 10rem 536 · 5.5rem 464.
  it('a high column whose text fits the common floor takes that floor, and the list does not go to cards', async () => {
    const day = { key: 'day', label: 'Date', priority: 'high' };
    const t = await mountAt(470, { columns: [day, ...PLAIN], rows: [{ ...ROWS[0], day: 'Sat 21 Nov' }], actions: ACTIONS, views: ['table', 'cards'] });
    expect(isCards(t)).toBe(false);
    expect(rowButtons(t)).toEqual(['edit', 'stock']);
    expect(nameTrack(t)).toBe('minmax(5.5rem,1.4fr)');
  });

  it('a box that widens again gives the name its 10rem back', async () => {
    const t = await mountAt(500, { columns: [NAME_COLUMN, ...LOW], actions: ACTIONS, views: false });
    await resize(540);
    expect(nameTrack(t)).toBe('minmax(min(10rem,209px),209px)');
  });
});
