import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { scopedStyle } from './__tests__/styles';
import { floorTable, held, seated } from './__tests__/tables';
import FloorCard from './FloorCard.vue';
import FloorCards from './FloorCards.vue';

const { rule } = scopedStyle('FloorCards.vue');

const ROOM = [
  held({ id: 't10', number: '10', testid: 'card-t10' }),
  seated({ id: 't2', number: '2', testid: 'card-t2' }),
  floorTable({ id: 't1', number: '1', testid: 'card-t1' }),
];

function cards() {
  const wrapper = mount(FloorCards, { props: { tables: ROOM, label: 'Tables by number' } });
  return { wrapper, ids: () => wrapper.findAll('[data-testid^="card-"]').map((card) => card.attributes('data-testid')) };
}

describe('FloorCards', () => {
  it('lists the tables by number, each card an item of a named list', () => {
    const c = cards();
    const list = c.wrapper.find('[role="list"]');
    expect(list.attributes('aria-label')).toBe('Tables by number');
    expect(c.ids()).toEqual(['card-t1', 'card-t2', 'card-t10']);
    expect(c.wrapper.findAll('[role="listitem"]')).toHaveLength(3);
    expect(c.wrapper.findAll('[role="listitem"] > ion-card')).toHaveLength(3);
  });

  it('passes on which table was picked', async () => {
    const c = cards();
    c.wrapper.findAllComponents(FloorCard)[1].vm.$emit('select', 't2');
    expect(c.wrapper.emitted('select')).toEqual([['t2']]);
  });

  it('lays the cards two to a row from the list, not from the card', () => {
    expect(rule('.floor-cards')).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
  });
});
