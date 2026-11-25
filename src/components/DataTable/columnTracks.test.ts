import { describe, expect, it } from 'vitest';

import { columnTracks, lentFloors } from './columnTracks';
import type { DataTableColumn } from './types';

type Row = Record<string, unknown>;
const col = (column: Partial<DataTableColumn<Row>> & { key: string }): DataTableColumn<Row> => ({ label: column.key, ...column });

/** The px a track keeps at least, with a 16px rem. */
function minimum(track: string): number {
  const [, floor, unit] = /^minmax\((?:min\()?([\d.]+)(rem|px)/.exec(track) ?? [];
  const own = Number(floor) * (unit === 'rem' ? 16 : 1);
  const held = /^minmax\(min\([\d.]+rem,(\d+)px\)/.exec(track);
  return held ? Math.min(own, Number(held[1])) : own;
}
const total = (tracks: string[]): number => tracks.reduce((sum, track) => sum + minimum(track), 0);

describe('lentFloors: what the short columns have to spare goes to the ones that would be cut', () => {
  const cut = (key: string, need: number, floor = 88) => ({ key, floor, need, spare: 0 });
  const short = (key: string, spare: number, floor = 88) => ({ key, floor, need: 0, spare });

  it('each cut column gets its part of what is missing, and each short one gives its part of what there is', () => {
    // Missing 20 and 60; to spare 30 and 10.
    expect(lentFloors([cut('a', 108), cut('b', 148), short('c', 30), short('d', 10)])).toEqual({ a: 98, b: 118, c: 58, d: 78 });
  });

  it('no column takes more than it is missing: the short ones keep the rest', () => {
    expect(lentFloors([cut('a', 98), short('c', 30), short('d', 10)])).toEqual({ a: 98, c: 80.5, d: 85.5 });
  });

  it('a column whose floor holds it whole takes nothing', () => {
    expect(lentFloors([cut('name', 105, 105), cut('a', 108), short('c', 10)])).toEqual({ a: 98, c: 78 });
  });

  it('nothing is cut, or nobody has anything to spare: every floor stays', () => {
    expect(lentFloors([short('c', 30), short('d', 10)])).toEqual({});
    expect(lentFloors([cut('a', 108), short('c', 0)])).toEqual({});
    expect(lentFloors([])).toEqual({});
  });

  it('the floors add up to the same, so what the list gives up next is decided as before', () => {
    const columns = [cut('a', 103), cut('b', 227), cut('name', 209, 160), short('c', 19), short('d', 3), short('e', 35)];
    const floors = lentFloors(columns);
    const before = columns.reduce((sum, column) => sum + column.floor, 0);
    const after = columns.reduce((sum, column) => sum + (floors[column.key] ?? column.floor), 0);
    expect(after).toBeCloseTo(before, 1);
  });
});

describe('columnTracks', () => {
  // The repeating appointments, in English: the professional's header and the repetition ask for more than 88px.
  const series = [
    col({ key: 'customer', priority: 'high' }),
    col({ key: 'service' }),
    col({ key: 'staff' }),
    col({ key: 'repeats' }),
    col({ key: 'starts', priority: 'low' }),
    col({ key: 'ends', priority: 'low' }),
    col({ key: 'active', cell: 'active', width: '6rem' }),
  ];
  const contentWidths = { customer: 110, service: 0, staff: 112, repeats: 227, starts: 0, ends: 0 };
  const spareWidths = { customer: 0, service: 16, staff: 0, repeats: 0, starts: 0, ends: 24 };

  it('with room every column is whole and keeps the common floor: nobody lends', () => {
    expect(columnTracks(series, { contentWidths, spareWidths })).toEqual([
      'minmax(110px,1.4fr)', 'minmax(5.5rem,1fr)', 'minmax(112px,1fr)', 'minmax(227px,1fr)', 'minmax(5.5rem,1fr)', 'minmax(5.5rem,1fr)', '6rem',
    ]);
  });

  it('out of room, the short columns go down to their text and the cut ones keep that much more', () => {
    const tracks = columnTracks(series, { contentWidths, spareWidths, clipped: true });
    expect(tracks).toEqual([
      'minmax(min(10rem,110px),110px)', 'minmax(72px,1fr)', 'minmax(93.89px,112px)', 'minmax(122.11px,227px)', 'minmax(5.5rem,1fr)', 'minmax(64px,1fr)', '6rem',
    ]);
    expect(total(tracks.slice(0, -1))).toBeCloseTo(total(columnTracks(series, { contentWidths, clipped: true }).slice(0, -1)), 1);
  });

  it('a short name lends too, and keeps its larger share', () => {
    const tracks = columnTracks(series.slice(0, 3), {
      contentWidths: { customer: 0, service: 0, staff: 112 },
      spareWidths: { customer: 12, service: 0 },
      clipped: true,
    });
    expect(tracks).toEqual(['minmax(76px,1.4fr)', 'minmax(5.5rem,1fr)', 'minmax(100px,112px)']);
  });

  it('only a column of plain text lends: what another one paints may not say its width when it is squeezed', () => {
    const other = [col({ key: 'cell', cell: 'status' }), col({ key: 'switch', toggle: { checked: () => true, label: () => '' } as never }), col({ key: 'who', identity: { icon: () => '' } })];
    const tracks = columnTracks([...other, col({ key: 'staff' })], {
      contentWidths: { cell: 0, switch: 0, who: 0, staff: 112 },
      spareWidths: { cell: 30, switch: 30, who: 30 },
      clipped: true,
    });
    expect(tracks).toEqual(['minmax(5.5rem,1fr)', 'minmax(5.5rem,1fr)', 'minmax(5.5rem,1.4fr)', 'minmax(5.5rem,112px)']);
  });

  it('a column that still asks for more than its floor lends nothing, though its text is now shorter', () => {
    const tracks = columnTracks([col({ key: 'email' }), col({ key: 'city' })], {
      contentWidths: { email: 121, city: 0 },
      spareWidths: { email: 27, city: 20 },
      clipped: true,
    });
    expect(tracks).toEqual(['minmax(108px,121px)', 'minmax(68px,1fr)']);
  });

  it('a column on its own floor (`minWidth`) keeps it when it is short, and takes what it misses when it is cut', () => {
    const own = (minWidth: string) => [col({ key: 'status', minWidth }), col({ key: 'city' })];
    const cut = { contentWidths: { status: 200, city: 0 }, spareWidths: { city: 20 }, clipped: true as const };
    expect(columnTracks(own('10.5rem'), cut)).toEqual(['minmax(188px,200px)', 'minmax(68px,1fr)']);
    expect(columnTracks(own('168px'), cut)).toEqual(['minmax(188px,200px)', 'minmax(68px,1fr)']);
    expect(columnTracks(own('20ch'), cut), 'a floor with no px to add to').toEqual(['minmax(20ch,200px)', 'minmax(5.5rem,1fr)']);
    expect(
      columnTracks([col({ key: 'status', minWidth: '10.5rem' }), col({ key: 'staff' })], {
        contentWidths: { status: 0, staff: 112 },
        spareWidths: { status: 30 },
        clipped: true,
      }),
    ).toEqual(['minmax(10.5rem,1fr)', 'minmax(5.5rem,112px)']);
  });

  it('the name that keeps 10rem takes what it misses from there, and from the common floor once it gives them up', () => {
    const columns = [col({ key: 'name', priority: 'high' }), col({ key: 'city' })];
    const cut = { contentWidths: { name: 209, city: 0 }, spareWidths: { city: 20 } };
    expect(columnTracks(columns, { ...cut, clipped: true })).toEqual(['minmax(180px,209px)', 'minmax(68px,1fr)']);
    expect(columnTracks(columns, { ...cut, clipped: 'tight' })).toEqual(['minmax(108px,209px)', 'minmax(68px,1fr)']);
  });

  it('the floors are measured with the size of the text of the page (`rem`)', () => {
    expect(columnTracks([col({ key: 'staff' }), col({ key: 'city' })], { contentWidths: { staff: 150, city: 0 }, spareWidths: { city: 20 }, rem: 20, clipped: true })).toEqual([
      'minmax(130px,150px)', 'minmax(90px,1fr)',
    ]);
  });

  it('a column the box hides neither lends nor takes: only the ones painted count', () => {
    expect(columnTracks(series.filter((c) => c.priority !== 'low'), { contentWidths, spareWidths, clipped: true })).toEqual([
      'minmax(min(10rem,110px),110px)', 'minmax(72px,1fr)', 'minmax(90.36px,112px)', 'minmax(101.64px,227px)', '6rem',
    ]);
  });
});
