import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import HubIcon from '../../shell/HubIcon.vue';
import { scopedStyle } from './__tests__/styles';
import { floorTable, held, requested, seated, unrequested } from './__tests__/tables';
import FloorTile from './FloorTile.vue';
import { FLOOR_BILL_ICON, FLOOR_STATUS_ICONS, type FloorBox, type FloorTable } from './model';
import TableGlyph from './TableGlyph.vue';

const { rule } = scopedStyle('FloorTile.vue');

const BOX: FloorBox = { x: 242, y: 105.2, width: 156, height: 93.6, slot: 240 };

function tile(table: FloorTable = floorTable(), more: Record<string, unknown> = {}) {
  const wrapper = mount(FloorTile, { props: { table, box: BOX, ...more } });
  const part = (name: string) => wrapper.find(`[data-part="${name}"]`);
  return { wrapper, el: wrapper.element as HTMLElement, part, button: () => wrapper.find('button') };
}

describe('FloorTile', () => {
  it('paints the table at its box, with its number, one line inside and its label under it', () => {
    const t = tile(floorTable({ testid: 'table-floor-tile-t1' }));
    expect([t.el.style.left, t.el.style.top, t.el.style.width, t.el.style.height]).toEqual(['242px', '105.2px', '156px', '93.6px']);
    expect(t.el.style.getPropertyValue('--tile-slot')).toBe('240px');
    expect(t.part('number').text()).toBe('4');
    expect(t.part('line').text()).toBe('Available');
    expect(t.part('status').text()).toBe('4 pax');
    expect(t.part('status').find('ion-icon').exists()).toBe(true);
    expect(t.el.getAttribute('data-status')).toBe('available');
    expect(t.el.getAttribute('data-testid')).toBe('table-floor-tile-t1');
    expect(t.el.getAttribute('role')).toBeNull();
    expect(t.button().attributes('type')).toBe('button');
    expect(t.button().attributes('aria-label')).toBe('Table 4 · Dining room · 4 pax · Available');
    expect(t.button().attributes('title')).toBe('Table 4 · Dining room · 4 pax · Available');
  });

  it('an occupied table shows its time inside, its guests under it and its seats and arc around it', () => {
    const t = tile(seated({ tone: 'critical' }));
    expect(t.part('line').text()).toBe('0:35');
    expect(t.part('line').attributes('data-tone')).toBe('critical');
    expect(t.part('status').text()).toBe('Occupied · 3/4 pax');
    expect(t.el.getAttribute('data-timer')).toBe('critical');
    expect(t.wrapper.findComponent(TableGlyph).props('table')).toMatchObject({ status: 'occupied', guests: 3, tone: 'critical' });
  });

  it('writes the bill of an occupied table in its label under it, never over its number, its time or its guests', () => {
    const t = tile(seated({ amount: '42,50 €' }));
    expect(t.wrapper.find('.table-tile__caption [data-part="amount"]').text()).toBe('42,50 €');
    expect(t.button().find('[data-part="amount"]').exists()).toBe(false);
    expect([t.part('number').text(), t.part('line').text(), t.part('status').text()]).toEqual(['4', '0:35', 'Occupied · 3/4 pax']);
    expect(tile(floorTable({ amount: '42,50 €' })).part('amount').exists()).toBe(false);
  });

  it('an occupied table whose bill was requested is painted apart, with the bill icon by its status, and keeps all it says', () => {
    const t = tile(requested());
    expect(t.el.getAttribute('data-status')).toBe('occupied');
    expect(t.el.getAttribute('data-bill')).toBe('requested');
    expect(t.wrapper.findComponent(TableGlyph).attributes('data-bill')).toBe('requested');
    expect(t.part('status').findComponent(HubIcon).props('name')).toBe(FLOOR_BILL_ICON);
    const said = ['number', 'line', 'status', 'amount'].map((name) => t.part(name).text());
    expect(said).toEqual(['4', '0:35', 'Bill requested · 3/4 pax', '42,50 €']);
    expect(t.button().attributes('aria-label')).toBe(requested().accessible);
  });

  it('no other table carries the mark: free, reserved or blocked ones, nor an occupied one without it', () => {
    for (const table of unrequested()) {
      const t = tile(table);
      expect(t.el.hasAttribute('data-bill'), table.status).toBe(false);
      expect(t.wrapper.findComponent(TableGlyph).attributes('data-bill'), table.status).toBeUndefined();
      expect(t.part('status').findComponent(HubIcon).props('name')).toBe(FLOOR_STATUS_ICONS[table.status]);
    }
  });

  it('a reservation paints its name and its hour apart, and no hold line without one', () => {
    const t = tile(held());
    expect(t.part('hold-name').text()).toBe('Maximiliana Fernández');
    expect(t.part('hold-time').text()).toBe('· 20:00');
    expect(t.part('line').text()).toBe('20:00');
    expect(t.part('status').text()).toBe('Reserved · 4 pax');
    expect(tile(held({ holdTime: '' })).part('hold-time').exists()).toBe(false);
    expect(tile().part('hold-name').exists()).toBe(false);
  });

  it('marks its shape, and greys out an inactive table with its note', () => {
    expect(tile(floorTable({ shape: 'round' })).el.classList.contains('table-tile--round')).toBe(true);
    expect(tile(floorTable({ shape: 'rectangle' })).el.classList.contains('table-tile--rectangle')).toBe(true);
    const idle = tile(floorTable(), { inactiveLabel: 'Inactive' });
    expect(idle.el.classList.contains('table-tile--inactive')).toBe(true);
    expect(idle.part('inactive').text()).toBe('Inactive');
    expect(tile().part('inactive').exists()).toBe(false);
    expect(tile().el.classList.contains('table-tile--inactive')).toBe(false);
  });

  it('is grabbed while the plan is edited and lifted while it is dragged', () => {
    const t = tile(floorTable(), { editing: true, dragging: true });
    expect(t.el.classList.contains('table-tile--editing')).toBe(true);
    expect(t.el.classList.contains('table-tile--dragging')).toBe(true);
    expect(rule('.table-tile--editing .table-tile__button')).toContain('cursor: grab');
    expect(rule('.table-tile--editing .table-tile__button')).toContain('touch-action: none');
    expect(tile().el.classList.contains('table-tile--editing')).toBe(false);
  });

  it('while picking a destination, an invalid table is dimmed and out of reach, a valid one marked', () => {
    const t = tile(seated({ pickable: false }));
    expect(t.button().attributes('aria-disabled')).toBe('true');
    expect(t.button().attributes('tabindex')).toBe('-1');
    expect(t.button().attributes('disabled')).toBeDefined();
    expect(t.el.classList.contains('table-tile--dimmed')).toBe(true);
    const ok = tile(floorTable({ pickable: true }));
    expect(ok.el.classList.contains('table-tile--target')).toBe(true);
    expect(ok.button().attributes('aria-disabled')).toBeUndefined();
    expect(ok.button().attributes('tabindex')).toBe('0');
  });
});
