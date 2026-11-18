import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { floorTable, seated } from './__tests__/tables';
import type { FloorGlyphTable } from './model';
import TableGlyph from './TableGlyph.vue';

function glyph(table: FloorGlyphTable = floorTable(), variant?: 'plan' | 'mini') {
  const wrapper = mount(TableGlyph, { props: { table, ...(variant ? { variant } : {}) } });
  const seats = () => wrapper.findAll('[data-part="seat"]');
  const filled = () => seats().filter((seat) => seat.classes().includes('table-glyph__seat--filled'));
  return { wrapper, el: wrapper.element as HTMLElement, seats, filled };
}

describe('TableGlyph', () => {
  it('is decorative and draws seats for the table capacity', () => {
    const g = glyph();
    expect(g.el.getAttribute('aria-hidden')).toBe('true');
    expect(g.seats()).toHaveLength(4);
    expect(g.filled()).toHaveLength(0);
    expect(g.wrapper.find('.table-glyph__arc').exists()).toBe(false);
  });

  it('fills seats from seated guests, proportionally above twelve places', () => {
    expect(glyph(seated()).filled()).toHaveLength(3);
    const large = glyph(seated({ capacity: 24, guests: 6 }));
    expect(large.seats()).toHaveLength(12);
    expect(large.filled()).toHaveLength(3);
  });

  it('draws a circular arc for a round occupied table', () => {
    const g = glyph(seated({ shape: 'round', tone: 'warning', progress: 68 }));
    const arc = g.wrapper.find('.table-glyph__arc');
    expect(arc.attributes('data-tone')).toBe('warning');
    expect(g.el.getAttribute('data-tone')).toBe('warning');
    const value = arc.find('circle.table-glyph__arc-value');
    expect(value.attributes('stroke-dasharray')).toBe('68 32');
    expect(value.attributes('pathLength')).toBe('100');
    expect(value.attributes('vector-effect')).toBe('non-scaling-stroke');
  });

  it('draws a rectangular arc and supports the miniature variant', () => {
    const g = glyph(seated({ shape: 'rectangle', progress: 25 }), 'mini');
    expect(g.el.classList.contains('table-glyph--mini')).toBe(true);
    expect(g.wrapper.find('rect.table-glyph__arc-value').attributes('stroke-dasharray')).toBe('25 75');
    expect(g.wrapper.find('rect.table-glyph__arc-value').attributes('vector-effect')).toBe('non-scaling-stroke');
  });

  it('keeps the arc between empty and full whatever progress it is given', () => {
    expect(glyph(seated({ progress: 140 })).wrapper.find('.table-glyph__arc-value').attributes('stroke-dasharray')).toBe('100 0');
  });

  it('draws only the track while no time has passed, never a dot of an empty arc', () => {
    const g = glyph(seated({ progress: 0 }));
    expect(g.wrapper.find('.table-glyph__arc-track').exists()).toBe(true);
    expect(g.wrapper.find('.table-glyph__arc-value').exists()).toBe(false);
  });

  it('the miniature draws the table itself in its shape and status; on the plan the tile is the table', () => {
    const mini = glyph(floorTable({ shape: 'round', status: 'reserved' }), 'mini');
    expect(mini.wrapper.find('.table-glyph__body').exists()).toBe(true);
    expect(mini.el.getAttribute('data-shape')).toBe('round');
    expect(mini.el.getAttribute('data-status')).toBe('reserved');
    expect(glyph().wrapper.find('.table-glyph__body').exists()).toBe(false);
  });

  it('seats a flattened rectangle along its long sides', () => {
    const g = glyph(floorTable({ shape: 'rectangle', capacity: 6, ratio: 1.47 }));
    const tops = g.seats().map((seat) => (seat.element as HTMLElement).style.top);
    expect([tops.filter((top) => top === '-10%').length, tops.filter((top) => top === '110%').length]).toEqual([2, 2]);
  });
});
