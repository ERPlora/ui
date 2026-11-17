import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createShellI18n } from '../i18n';
import { openExternalLink } from '../open-external';
import { useToasts } from '../toast-store';
import { connectActionCenter, useActionCenter } from './center';
import { useNoticeAction } from './notice-action';
import type { ActionNotice } from './types';

vi.mock('../open-external', () => ({ openExternalLink: vi.fn() }));

const base: ActionNotice = {
  id: 'billing.unpaid',
  severity: 'danger',
  icon: 'ion:receipt-outline',
  label: 'Unpaid invoice',
  title: 'An invoice needs paying',
};

let router: Router;
let disconnect: (() => void) | undefined;

async function setup(notice: ActionNotice, locale = 'en') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/billing', component: { template: '<div />' } },
    ],
  });
  await router.push('/');
  disconnect = connectActionCenter({ notices: ref([notice]), failed: ref(false) });
  useActionCenter().openPanel(notice.id);
  const Host = defineComponent({
    setup() {
      const { run } = useNoticeAction();
      return { run };
    },
    template: '<div />',
  });
  const wrapper = mount(Host, { global: { plugins: [router, createShellI18n({ locale })] } });
  return { wrapper, run: wrapper.vm.run };
}

afterEach(() => {
  disconnect?.();
  disconnect = undefined;
  const stack = useToasts();
  for (const toast of [...stack.bottom.value, ...stack.top.value]) stack.dismiss(toast.id);
});

describe('useNoticeAction', () => {
  it('navigates to a route destination and closes the panel', async () => {
    const { run } = await setup({ ...base, action: { label: 'Pay', to: '/billing' } });
    await run({ ...base, action: { label: 'Pay', to: '/billing' } }, 'primary');
    expect(router.currentRoute.value.path).toBe('/billing');
    expect(useActionCenter().open.value).toBe(false);
  });

  it('hands an external destination to the shell opener and closes the panel', async () => {
    const notice = { ...base, action: { label: 'Pay', href: 'https://erplora.com/billing' } };
    const { run } = await setup(notice);
    const event = new MouseEvent('click', { cancelable: true });
    await run(notice, 'primary', event);
    expect(openExternalLink).toHaveBeenCalledWith('https://erplora.com/billing', event);
    expect(useActionCenter().open.value).toBe(false);
  });

  it('runs an in-place action without closing the panel', async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const notice = { ...base, action: { label: 'Pay', run: action } };
    const { run } = await setup(notice);
    await run(notice, 'primary');
    expect(action).toHaveBeenCalledOnce();
    expect(useActionCenter().open.value).toBe(true);
  });

  it('shows a translated generic error and leaves the notice and panel as they were', async () => {
    const notice = { ...base, action: { label: 'Pagar', run: vi.fn().mockRejectedValue(new Error('private detail')) } };
    const { run } = await setup(notice, 'es');
    await run(notice, 'primary');
    expect(useActionCenter().open.value).toBe(true);
    expect(useActionCenter().featured.value?.id).toBe(base.id);
    const messages = useToasts().bottom.value.map((toast) => toast.message);
    expect(messages).toContain('No se pudo completar la acción. Inténtalo de nuevo.');
    expect(messages.join(' ')).not.toContain('private detail');
  });
});
