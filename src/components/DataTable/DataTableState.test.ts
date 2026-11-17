import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import DataTableState from './DataTableState.vue';

const labels = { loading: 'Loading apps…', errorTitle: 'Could not load', empty: 'No apps', retry: 'Retry', reset: 'Show all' };

function mountState(kind: 'loading' | 'error' | 'empty', props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(DataTableState, { props: { kind, labels, testid: 'apps', ...props }, slots });
}

describe('DataTableState', () => {
  it('announces loading and preserves the card shape with Ionic skeletons', () => {
    const wrapper = mountState('loading');
    expect(wrapper.find('.data-table__loading').attributes('role')).toBe('status');
    expect(wrapper.find('.data-table__loading').text()).toContain('Loading apps…');
    expect(wrapper.findAll('ion-skeleton-text').length).toBeGreaterThan(2);
    expect(wrapper.find('.data-table__loading').attributes('data-testid')).toBe('apps-loading');
  });

  it('shows the error reason and emits retry', async () => {
    const wrapper = mountState('error', { errorReason: 'Network down' });
    expect(wrapper.find('.data-table__error').attributes('role')).toBe('alert');
    expect(wrapper.text()).toContain('Network down');
    await wrapper.find('[data-testid="apps-retry"]').trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('offers reset for an empty search and keeps the custom empty slot', async () => {
    const wrapper = mountState('empty', { canReset: true });
    await wrapper.find('[data-testid="apps-show-all"]').trigger('click');
    expect(wrapper.emitted('reset')).toHaveLength(1);
    const custom = mountState('empty', {}, { empty: '<p class="custom-empty">Nothing here</p>' });
    expect(custom.find('.custom-empty').exists()).toBe(true);
  });
});
