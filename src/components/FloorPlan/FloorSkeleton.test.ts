import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FloorSkeleton from './FloorSkeleton.vue';

type Block = HTMLElement & { animated?: boolean };

describe('FloorSkeleton', () => {
  it('stands for the plan while it loads: tables of both shapes, shimmering, named for a screen reader', () => {
    const wrapper = mount(FloorSkeleton, { props: { label: 'Loading the floor plan' } });
    expect(wrapper.attributes('role')).toBe('progressbar');
    expect(wrapper.attributes('aria-label')).toBe('Loading the floor plan');
    expect(wrapper.classes()).toContain('floor-skeleton--plan');
    const blocks = wrapper.findAll('ion-skeleton-text');
    expect(blocks).toHaveLength(8);
    expect(blocks.every((block) => (block.element as Block).animated === true)).toBe(true);
    expect(blocks.map((block) => block.classes().includes('floor-skeleton__table--round'))).toEqual([false, false, true, false, false, true, false, false]);
  });

  it('on a phone stands for the cards, two to a row, each an Ionic skeleton', () => {
    const wrapper = mount(FloorSkeleton, { props: { label: 'Cargando el plano de sala', variant: 'cards' } });
    expect(wrapper.attributes('aria-label')).toBe('Cargando el plano de sala');
    expect(wrapper.classes()).toContain('floor-skeleton--cards');
    const cards = wrapper.findAll('ion-skeleton-text.floor-skeleton__card');
    expect(cards).toHaveLength(6);
    expect(cards.every((card) => (card.element as Block).animated === true)).toBe(true);
  });
});
