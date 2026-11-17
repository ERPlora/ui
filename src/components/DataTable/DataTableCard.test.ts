import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DataTableCard from './DataTableCard.vue';

const row = { id: '1', name: 'Invoicing', total: '10,00 €' };
const actions = { items: [], menu: [] };

function mountCard(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(DataTableCard, {
    props: {
      row,
      rowId: '1',
      title: 'Invoicing',
      fields: [{ key: 'total', label: 'Total' }],
      actions,
      testid: 'apps',
      ...props,
    },
    slots,
  });
}

describe('DataTableCard', () => {
  it('paints an Ionic card with its heading, fields and test hooks', () => {
    const wrapper = mountCard({ icon: 'document-text-outline' });
    expect(wrapper.find('ion-card.data-table__card').exists()).toBe(true);
    expect(wrapper.find('.data-table__card-title').text()).toBe('Invoicing');
    expect(wrapper.find('.data-table__field-label').text()).toBe('Total');
    expect(wrapper.find('.data-table__field-value').text()).toBe('10,00 €');
    expect(wrapper.find('ion-card').attributes('data-testid')).toBe('apps-row');
    expect(wrapper.find('ion-card').attributes('data-id')).toBe('1');
  });

  it('uses the title column cell slot without repeating it in the body', () => {
    const wrapper = mountCard(
      { titleColumn: { key: 'name', label: 'App', cell: 'app' }, fields: [] },
      { app: '<template #app="{ row }"><strong class="custom-title">{{ row.name }}</strong></template>' },
    );
    expect(wrapper.find('.data-table__card-title .custom-title').text()).toBe('Invoicing');
    expect(wrapper.findAll('.data-table__field')).toHaveLength(0);
  });

  it('emits opening, selection and keyboard activation from the same card', async () => {
    const wrapper = mountCard({ clickable: true, selectable: true });
    await wrapper.find('ion-card').trigger('click');
    await wrapper.find('ion-card').trigger('keydown', { key: 'Enter' });
    await wrapper.find('ion-checkbox').trigger('ionChange', { checked: true });
    expect(wrapper.emitted('open')).toEqual([[row], [row]]);
    expect(wrapper.emitted('select')).toEqual([['1']]);
    expect(wrapper.find('ion-card').attributes('role')).toBe('button');
    expect(wrapper.find('ion-card').attributes('tabindex')).toBe('0');
  });
});
