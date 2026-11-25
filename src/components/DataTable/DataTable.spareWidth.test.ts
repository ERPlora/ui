// A row with no room for every column whole: the short columns give what they have to spare to the ones that would be
// cut, and what the list gives up next is decided at the same widths as without it. happy-dom lays nothing out: a fake
// engine sizes the row from the minimum of each track of its template.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cellTextWidth, clearLayout, dataRows, mountTable, playBackLayout, resize, setBoxWidth, settle, templateWidth, text } from './__tests__/harness';

type Table = ReturnType<typeof mountTable>;

const PAD = 32;
const CHAR = 8;
const REM = 16;

/** The minimum a track of the head's template takes, in px. */
function trackMin(track: string): number {
  const held = /^minmax\(min\(([\d.]+)rem,(\d+)px\),/.exec(track);
  if (held) return Math.min(Number(held[1]) * REM, Number(held[2]));
  const floor = /^minmax\(([\d.]+)(rem|px),/.exec(track);
  if (floor) return Number(floor[1]) * (floor[2] === 'rem' ? REM : 1);
  const own = /^([\d.]+)(rem|px)$/.exec(track);
  if (own) return Number(own[1]) * (own[2] === 'rem' ? REM : 1);
  throw new Error(`the fake engine does not size «${track}»`);
}

beforeEach(() => {
  // The box of every element is 0px wide, so a text takes what its characters say and nothing else.
  playBackLayout(0, (el) => {
    if (el.classList.contains('data-table__scroll')) return Math.round(templateWidth(el, PAD, trackMin));
    return cellTextWidth(el, CHAR) ?? 0;
  });
});

afterEach(clearLayout);

const COLUMNS = [
  { key: 'customer', label: 'Customer', priority: 'high', sortable: false },
  { key: 'service', label: 'Service', sortable: false },
  { key: 'staff', label: 'Professional', sortable: false },
  { key: 'repeats', label: 'Repeats', sortable: false },
  { key: 'ends', label: 'Ends', priority: 'low', sortable: false },
];
// Customer 64 of its 88 · Service 56 of its 88 · Professional 96 · Repeats 248 · Ends 48 of its 88.
const ROWS = [{ id: 's1', customer: 'Ana Ruiz', service: 'Cut', staff: 'Eva', repeats: 'Every week Wednesday at 5:30 PM', ends: 'No end' }];

const template = (t: Table) => (t.element.querySelector('.data-table__row--head') as HTMLElement).style.gridTemplateColumns;
const headers = (t: Table) => [...t.element.querySelectorAll('.data-table__row--head [role=columnheader]')].map((head) => text(head));

async function mountAt(width: number, columns: Record<string, unknown>[] = COLUMNS): Promise<Table> {
  setBoxWidth(width);
  const t = mountTable({ rows: ROWS, columns, views: false });
  await settle();
  return t;
}

describe('the short columns lend what they have to spare before any column is cut', () => {
  // Whole 642 (88 + 88 + 97 + 249 + 88 + 32) · cut 472, with every column on its floor.
  it('with room for every column whole nobody lends', async () => {
    expect(template(await mountAt(642))).toBe('minmax(5.5rem,1.4fr) minmax(5.5rem,1fr) minmax(97px,1fr) minmax(249px,1fr) minmax(5.5rem,1fr)');
  });

  // 23 + 31 + 39 to spare, 9 + 161 missing: the cut columns keep 93px more than their floor between them.
  it('out of room, each short column keeps its text whole and the rest goes to the header and the long cell', async () => {
    const t = await mountAt(600);
    const tracks = template(t).split(' ');
    expect(tracks).toEqual(['minmax(65px,1.4fr)', 'minmax(57px,1fr)', 'minmax(92.92px,97px)', 'minmax(176.08px,249px)', 'minmax(49px,1fr)']);
    // What is left of the 600px holds both whole: 568 less the short ones is 397 for the 346 they ask for.
    const short = [0, 1, 4].reduce((sum, i) => sum + trackMin(tracks[i]), 0);
    expect(600 - PAD - short).toBeGreaterThanOrEqual(97 + 249);
  });

  it('the list gives up its low column at the same width as when nobody lends', async () => {
    const t = await mountAt(472);
    expect(headers(t)).toEqual(['Customer', 'Service', 'Professional', 'Repeats', 'Ends']);
    await resize(471);
    expect(headers(t)).toEqual(['Customer', 'Service', 'Professional', 'Repeats']);
  });

  it('a column the page paints with its own slot keeps the common floor', async () => {
    const t = await mountAt(600, COLUMNS.map((column) => (column.key === 'service' ? { ...column, cell: 'service' } : column)));
    expect(template(t).split(' ')[1]).toBe('minmax(5.5rem,1fr)');
  });

  it('a short text that grows takes its room back, and the list stays as it was', async () => {
    const t = await mountAt(600);
    await t.setProps({ rows: [{ ...ROWS[0], ends: 'Dec 24 26' }] });
    await settle();
    expect(dataRows(t)).toHaveLength(1);
    expect(template(t).split(' ')[4]).toBe('minmax(73px,1fr)');
    expect(headers(t)).toContain('Ends');
  });
});
