import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { scopedStyle } from './__tests__/styles';
import { floorTable, held } from './__tests__/tables';
import FloorTileCaption from './FloorTileCaption.vue';
import type { FloorTable } from './model';

const { rule } = scopedStyle('FloorTileCaption.vue');

function caption(table: FloorTable = floorTable(), inactiveLabel = '') {
  const wrapper = mount(FloorTileCaption, { props: { table, inactiveLabel } });
  return { wrapper, part: (name: string) => wrapper.find(`[data-part="${name}"]`) };
}

describe('FloorTileCaption', () => {
  it('writes the status with its icon, never the colour alone', () => {
    const c = caption();
    expect(c.wrapper.classes()).toContain('table-tile__caption');
    expect(c.part('status').text()).toBe('4 pax');
    expect(c.part('status').find('ion-icon').exists()).toBe(true);
    expect(c.part('hold-name').exists()).toBe(false);
    expect(c.part('inactive').exists()).toBe(false);
  });

  it('names who holds the reservation and from what hour, apart', () => {
    const c = caption(held());
    expect(c.part('hold-name').text()).toBe('Maximiliana Fernández');
    expect(c.part('hold-time').text()).toBe('· 20:00');
    expect(caption(held({ holdTime: '' })).part('hold-time').exists()).toBe(false);
  });

  it('says why a table is greyed out', () => {
    expect(caption(floorTable(), 'Inactive').part('inactive').text()).toBe('Inactive');
  });

  it('cuts a long reservation name with an ellipsis inside the place the table owns, never its hour', () => {
    expect(rule('.table-tile__caption')).toContain('max-width: var(--tile-slot)');
    expect(rule('.table-tile__hold')).toContain('display: flex');
    const name = rule('.table-tile__hold-name');
    expect(name).toContain('overflow: hidden');
    expect(name).toContain('text-overflow: ellipsis');
    expect(name).toContain('white-space: nowrap');
    expect(rule('.table-tile__hold-time')).toContain('flex: none');
  });
});
