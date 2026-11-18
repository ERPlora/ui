import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IonModalStub } from '../../components/FormModal/__tests__/ionModalStub';
import { createShellI18n } from '../i18n';
import ActionLayer from './ActionLayer.vue';
import { useActionCenter } from './center';
import type { ActionNotice, ActionNoticeSource } from './types';

const notice: ActionNotice = {
  id: 'billing.unpaid',
  severity: 'danger',
  icon: 'ion:receipt-outline',
  label: 'Unpaid invoice',
  title: 'An invoice needs paying',
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('ActionLayer', () => {
  it('calls the source factory once, connects it and mounts arrival and panel once', async () => {
    const notices = ref<readonly ActionNotice[] | undefined>([]);
    const source: ActionNoticeSource = { notices, failed: ref(false) };
    const actionNotices = vi.fn(() => source);
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
    const wrapper = mount(ActionLayer, {
      props: { actionNotices },
      global: { plugins: [router, createShellI18n({ locale: 'en' })], stubs: { IonModal: IonModalStub } },
      attachTo: document.body,
    });
    expect(actionNotices).toHaveBeenCalledOnce();
    expect(wrapper.findAll('[data-testid="action-panel"]')).toHaveLength(1);
    expect(wrapper.find('.action-arrival-layer').exists()).toBe(true);

    notices.value = [notice];
    await flushPromises();
    expect(useActionCenter().total.value).toBe(1);
    expect(wrapper.get('[data-testid="action-arrival"]').text()).toContain('An invoice needs paying');
    wrapper.unmount();
    expect(useActionCenter().total.value).toBe(0);
  });
});
