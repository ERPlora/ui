import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { scopedStyle } from './__tests__/styles';
import { floorTable, held, seated } from './__tests__/tables';
import FloorCard from './FloorCard.vue';
import type { FloorTable } from './model';

const { rule, style } = scopedStyle('FloorCard.vue');

function card(table: FloorTable = seated({ testid: 'table-floor-tile-t2' })) {
  const wrapper = mount(FloorCard, { props: { table }, attachTo: document.body });
  const host = () => wrapper.element as HTMLElement & { button?: boolean };
  const native = () => host().shadowRoot?.querySelector('button');
  const part = (name: string) => wrapper.find(`[data-part="${name}"]`);
  return { wrapper, host, native, part, selected: () => (wrapper.emitted('select') ?? []).map(([id]) => id) };
}

describe('FloorCard', () => {
  it('is one Ionic card that is a button, on an opaque surface, with the table status and test id', () => {
    const c = card();
    expect(c.host().tagName).toBe('ION-CARD');
    expect(c.host().button).toBe(true);
    expect(c.wrapper.classes()).toEqual(expect.arrayContaining(['floor-card', 'ep-surface']));
    expect(c.host().getAttribute('data-status')).toBe('occupied');
    expect(c.host().getAttribute('data-shape')).toBe('square');
    expect(c.host().getAttribute('data-testid')).toBe('table-floor-tile-t2');
    expect(c.host().hasAttribute('disabled')).toBe(false);
    c.wrapper.unmount();
  });

  it('has a single touch target: nothing inside it is a button or an action', () => {
    const c = card();
    expect(c.wrapper.findAll('button, ion-button, a, [role="button"]')).toHaveLength(0);
    c.wrapper.unmount();
  });

  it('lays out three zones: the drawing, the number with its line, and the written status with its time', () => {
    const c = card();
    const zones = c.wrapper.findAll('.floor-card__media, .floor-card__content, .floor-card__status');
    expect(zones.map((zone) => zone.classes()[0])).toEqual(['floor-card__media', 'floor-card__content', 'floor-card__status']);
    expect(c.wrapper.find('.floor-card__media .table-glyph--mini').exists()).toBe(true);
    expect(['number', 'meta'].map((name) => c.wrapper.find(`.floor-card__content [data-part="${name}"]`).text())).toEqual(['4', '3/4 pax']);
    expect(['status', 'time'].map((name) => c.wrapper.find(`.floor-card__status [data-part="${name}"]`).text())).toEqual(['Occupied', '0:35']);
    expect(c.part('time').attributes('data-tone')).toBe('normal');
    c.wrapper.unmount();
  });

  it('says a reservation with its hour apart, and no time for a table that is not timed', () => {
    const c = card(held());
    expect(c.part('meta').text()).toBe('Maximiliana Fernández · 20:00');
    expect(c.wrapper.find('.floor-card__hold-time').text()).toBe('· 20:00');
    expect(c.part('status').text()).toBe('Reserved');
    expect(c.part('time').exists()).toBe(false);
    expect(card(floorTable()).part('meta').text()).toBe('4 pax');
    c.wrapper.unmount();
  });

  it('writes the bill of an occupied table next to its time', () => {
    const c = card(seated({ amount: '42,50 €' }));
    const parts = c.wrapper.findAll('.floor-card__status [data-part]');
    expect(parts.map((part) => [part.attributes('data-part'), part.text()])).toEqual([
      ['status', 'Occupied'],
      ['time', '0:35'],
      ['amount', '42,50 €'],
    ]);
    expect(c.part('meta').text()).toBe('3/4 pax');
    c.wrapper.unmount();
  });

  it('writes no bill for a table that is free, reserved or blocked, nor for one whose bill did not arrive', () => {
    const bill = { amount: '42,50 €' };
    for (const table of [floorTable(bill), held(bill), floorTable({ ...bill, status: 'blocked' }), seated(), seated({ amount: '' })]) {
      const c = card(table);
      expect(c.part('amount').exists(), table.status).toBe(false);
      c.wrapper.unmount();
    }
  });

  it('lets the bill drop under the time on a narrow card instead of running out of it, and keeps it on one line', () => {
    expect(rule('.floor-card__status')).toContain('flex-wrap: wrap');
    const bill = rule('.floor-card__amount');
    expect(bill).toContain('white-space: nowrap');
    expect(bill).toContain('font-variant-numeric: tabular-nums');
  });

  it('hands its full name to the button Ionic draws, and keeps it in step as the time passes', async () => {
    const c = card();
    await vi.waitFor(() => expect(c.native()?.getAttribute('aria-label')).toBe(seated().accessible));
    await c.wrapper.setProps({ table: seated({ accessible: 'Table 4 · 36 min' }) });
    await vi.waitFor(() => expect(c.native()?.getAttribute('aria-label')).toBe('Table 4 · 36 min'));
    expect(c.native()?.hasAttribute('aria-disabled')).toBe(false);
    c.wrapper.unmount();
  });

  it('a tap picks the table; one that may not be picked is dimmed and announced as unavailable, never disabled', async () => {
    const c = card(seated({ pickable: false }));
    await c.wrapper.trigger('click');
    expect(c.selected()).toEqual([]);
    expect(c.wrapper.classes()).toContain('floor-card--dimmed');
    expect(c.host().hasAttribute('disabled')).toBe(false);
    await vi.waitFor(() => expect(c.native()?.getAttribute('aria-disabled')).toBe('true'));
    await c.wrapper.setProps({ table: seated({ pickable: true }) });
    await vi.waitFor(() => expect(c.native()?.hasAttribute('aria-disabled')).toBe(false));
    expect(c.wrapper.classes()).toContain('floor-card--target');
    await c.wrapper.trigger('click');
    expect(c.selected()).toEqual(['t1']);
    c.wrapper.unmount();
  });

  it('keeps its status border, dashed when reserved, and marks a destination with a primary outline apart from it', () => {
    expect(rule('.floor-card')).toMatch(/border: 2px solid var\(--card-edge\)/);
    expect(rule(".floor-card[data-status='reserved']")).toContain('border-style: dashed');
    const target = rule('.floor-card--target');
    expect(target).toContain('outline: 2px solid var(--ep-primary-text)');
    expect(target).toContain('outline-offset');
  });

  it('is a touch tile: tokens for its radius and shadow, at least 112 px high, never glass', () => {
    const base = rule('.floor-card');
    expect(base).toMatch(/border-radius: var\(--ep-radius[a-z-]*\)/);
    expect(base).toMatch(/box-shadow: var\(--ep-shadow-(xs|sm)\)/);
    expect(base).toContain('min-height: 112px');
    expect(base).toContain('margin: 0');
    expect(style).not.toMatch(/backdrop-filter|ep-glass|--ep-shadow-float/);
  });
});
