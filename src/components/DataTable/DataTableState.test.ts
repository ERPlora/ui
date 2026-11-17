import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import EmptyState from '../EmptyState/EmptyState.vue';
import InlineFeedback from '../InlineFeedback/InlineFeedback.vue';
import { createShellI18n } from '../../shell/i18n';
import DataTableState from './DataTableState.vue';

const labels = { loading: 'Loading apps…', errorTitle: 'Could not load', empty: 'No apps', retry: 'Retry', reset: 'Show all' };

function mountState(kind: 'loading' | 'error' | 'empty', props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(DataTableState, { props: { kind, labels, testid: 'apps', ...props }, slots, global: { plugins: [createShellI18n({ locale: 'en' })] } });
}

describe('DataTableState', () => {
  it('announces loading and preserves the card shape with Ionic skeletons', () => {
    const wrapper = mountState('loading');
    expect(wrapper.find('.data-table__loading').attributes('role')).toBe('status');
    expect(wrapper.find('.data-table__loading').text()).toContain('Loading apps…');
    expect(wrapper.findAll('ion-skeleton-text').length).toBeGreaterThan(2);
    expect(wrapper.find('.data-table__loading').attributes('data-testid')).toBe('apps-loading');
  });

  it('says a failed load with the library’s danger notice: its title, its reason and «Retry»', async () => {
    const wrapper = mountState('error', { errorReason: 'Network down' });
    const notice = wrapper.findComponent(InlineFeedback);
    expect(notice.props()).toMatchObject({ tone: 'danger', heading: 'Could not load' });
    expect(wrapper.find('[data-role="load-error"] .data-table__error-reason').text()).toBe('Network down');
    const retry = notice.find('[data-testid="apps-retry"]');
    expect([retry.element.tagName, retry.attributes('data-role'), retry.text()]).toEqual(['ION-BUTTON', 'load-error-retry', 'Retry']);
    await retry.trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('a reason that only repeats nothing is left out', () => {
    expect(mountState('error').find('.data-table__error-reason').exists()).toBe(false);
  });

  it('says an empty list with the library’s empty state, with «Show all» for an empty search', async () => {
    const wrapper = mountState('empty', { canReset: true });
    expect(wrapper.findComponent(EmptyState).props('heading')).toBe('No apps');
    await wrapper.findComponent(EmptyState).find('[data-testid="apps-show-all"]').trigger('click');
    expect(wrapper.emitted('reset')).toHaveLength(1);
    expect(mountState('empty').find('[data-testid="apps-show-all"]').exists()).toBe(false);
  });

  it('keeps the page’s own empty slot instead', () => {
    const custom = mountState('empty', {}, { empty: '<p class="custom-empty">Nothing here</p>' });
    expect(custom.find('.custom-empty').exists()).toBe(true);
    expect(custom.findComponent(EmptyState).exists()).toBe(false);
  });
});
