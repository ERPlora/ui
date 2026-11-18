import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FloorSummary from './FloorSummary.vue';
import type { FloorStat } from './model';

const STATS: FloorStat[] = [
  { key: 'available', value: 2, label: 'Available' },
  { key: 'occupied', value: 2, label: 'Occupied' },
  { key: 'reserved', value: 1, label: 'Reserved' },
  { key: 'guests', value: 8, label: 'Guests' },
];

function summary(more: Record<string, unknown> = {}) {
  const wrapper = mount(FloorSummary, {
    props: { label: 'Zone summary', title: 'Dining room', subtitle: '2 of 6 tables occupied', color: 'secondary', stats: STATS, ...more },
  });
  return { wrapper, stat: (key: string) => wrapper.find(`[data-stat="${key}"]`) };
}

describe('FloorSummary', () => {
  it('sums up the zone: its name in its colour, how many are occupied, and each figure with its icon', () => {
    const s = summary();
    expect(s.wrapper.element.tagName).toBe('SECTION');
    expect(s.wrapper.attributes('aria-label')).toBe('Zone summary');
    expect((s.wrapper.element as HTMLElement).style.getPropertyValue('--zone-color')).toBe('var(--ion-color-secondary)');
    expect(s.wrapper.find('h2').text()).toBe('Dining room');
    expect(s.wrapper.find('[data-part="occupied-of"]').text()).toBe('2 of 6 tables occupied');
    expect(STATS.map(({ key }) => s.stat(key).text())).toEqual(['2Available', '2Occupied', '1Reserved', '8Guests']);
    expect(s.wrapper.findAll('.floor-summary__icon')).toHaveLength(4);
  });

  it('a zone without a colour is painted in the primary one', () => {
    expect((summary({ color: null }).wrapper.element as HTMLElement).style.getPropertyValue('--zone-color')).toBe('var(--ion-color-primary)');
  });
});
