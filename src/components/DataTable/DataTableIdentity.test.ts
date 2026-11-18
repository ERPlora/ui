import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import HubIcon from '../../shell/HubIcon.vue';
import DataTableIdentity from './DataTableIdentity.vue';

describe('DataTableIdentity', () => {
  it('paints the tiled icon, name and second line with the existing HubIcon', () => {
    const wrapper = mount(DataTableIdentity, {
      props: { icon: 'ion:cube-outline', title: 'Invoicing', subtitle: 'Free', testid: 'apps-plan' },
    });
    expect(wrapper.find('.data-table__identity-icon').classes()).toContain('ep-icon-tile');
    expect(wrapper.findComponent(HubIcon).props('name')).toBe('ion:cube-outline');
    expect(wrapper.find('.data-table__identity-title').text()).toBe('Invoicing');
    expect(wrapper.find('.data-table__identity-subtitle').text()).toBe('Free');
    expect(wrapper.find('[data-testid="apps-plan"]').text()).toBe('Free');
  });

  it('omits an empty second line and lets the name wrap without clipping', () => {
    const wrapper = mount(DataTableIdentity, { props: { title: 'A longer name' } });
    expect(wrapper.find('.data-table__identity-subtitle').exists()).toBe(false);
    expect(wrapper.find('.data-table__identity-title').text()).toBe('A longer name');
  });
});
