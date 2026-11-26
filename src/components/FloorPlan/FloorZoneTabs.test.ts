import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FloorZoneTabs from './FloorZoneTabs.vue';
import type { FloorZoneTab } from './model';

const ZONES: FloorZoneTab[] = [
  { id: 'z1', name: 'Dining room', color: 'primary', occupied: 1, total: 2, said: '1 of 2 tables occupied', testid: 'tab-z1' },
  { id: 'z2', name: 'Terrace', color: 'tertiary', occupied: 0, total: 1, said: '0 de 1 mesa ocupada', testid: 'tab-z2' },
];

function tabs() {
  const wrapper = mount(FloorZoneTabs, { props: { zones: ZONES, active: 'z1', label: 'Zones' }, attachTo: document.body });
  const tab = (id: string) => wrapper.find(`[data-testid="tab-${id}"]`);
  const part = (id: string, name: string) => tab(id).find(`[data-part="${name}"]`);
  return { wrapper, tab, part, strip: () => wrapper.find('ion-segment') };
}

describe('FloorZoneTabs', () => {
  it('names each zone with a dot of its colour and its occupied tables over those in service', () => {
    const z = tabs();
    expect([z.part('z1', 'zone-name').text(), z.part('z1', 'zone-count').text()]).toEqual(['Dining room', '1/2']);
    expect([z.part('z2', 'zone-name').text(), z.part('z2', 'zone-count').text()]).toEqual(['Terrace', '0/1']);
    expect((z.tab('z2').find('.zone-tab').element as HTMLElement).style.getPropertyValue('--zone-color')).toBe('var(--ion-color-tertiary)');
    expect(z.part('z1', 'zone-count').attributes('aria-hidden')).toBe('true');
    expect(z.part('z1', 'zone-count-said').text()).toBe('1 of 2 tables occupied');
    expect(z.part('z2', 'zone-count-said').text()).toBe('0 de 1 mesa ocupada');
    expect(z.strip().attributes('aria-label')).toBe('Zones');
    expect((z.strip().element as HTMLElement & { value?: string }).value).toBe('z1');
    z.wrapper.unmount();
  });

  it('tells the page which zone was chosen', async () => {
    const z = tabs();
    z.strip().element.dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'z2' }, bubbles: true }));
    await flushPromises();
    expect(z.wrapper.emitted('change')).toEqual([['z2']]);
    z.wrapper.unmount();
  });

  it('fades the edge with more zones behind it', async () => {
    const z = tabs();
    const strip = z.strip().element;
    Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: 700 });
    strip.dispatchEvent(new Event('scroll'));
    await flushPromises();
    expect(z.strip().classes()).toContain('floor-zone-tabs--more-right');
    expect(z.strip().classes()).not.toContain('floor-zone-tabs--more-left');
    z.wrapper.unmount();
  });

  it('fades the hidden edge when a zone added after it was painted no longer fits, with no scroll', async () => {
    const z = tabs();
    const strip = z.strip().element;
    Object.defineProperty(strip, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: 300 });
    await flushPromises();
    expect(z.strip().classes()).not.toContain('floor-zone-tabs--more-right');
    Object.defineProperty(strip, 'scrollWidth', { configurable: true, value: 700 });
    await z.wrapper.setProps({ zones: [...ZONES, { ...ZONES[1], id: 'z3', name: 'Private room', testid: 'tab-z3' }] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(z.strip().classes()).toContain('floor-zone-tabs--more-right');
    z.wrapper.unmount();
  });
});
