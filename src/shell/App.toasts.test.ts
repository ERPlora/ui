import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it } from 'vitest';

import App from './App.vue';
import { createShellI18n } from './i18n';
import { createShellSession, SESSION_KEY, type SessionMe, type SessionStatus } from './session';
import { SHELL_CONFIG_KEY } from './shell-config';
import { toastSuccess } from './toast';
import { useToasts } from './toast-store';

async function mountApp(me: SessionMe | undefined) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  await router.push('/');
  return mount(App, {
    global: {
      plugins: [router, createShellI18n({ locale: 'en' })],
      provide: {
        [SESSION_KEY as symbol]: createShellSession(ref(me), ref<SessionStatus>('live')),
        [SHELL_CONFIG_KEY as symbol]: { homePath: '/' },
      },
      stubs: { IonRouterOutlet: { template: '<div class="router-outlet-stub" />' } },
    },
    attachTo: document.body,
  });
}

afterEach(() => {
  const stack = useToasts();
  for (const each of [...stack.bottom.value, ...stack.top.value]) stack.dismiss(each.id);
  document.body.innerHTML = '';
});

describe('App: the toasts', () => {
  const me: SessionMe = { user: { id: 'u1', label: 'Ana Pérez' }, permissions: [], menu: [], apps: [], language: 'en' };

  it('mounts the one toast stack beside the screens, so a toast asked from anywhere is painted', async () => {
    const wrapper = await mountApp(me);
    toastSuccess('Product saved');
    await flushPromises();
    expect(wrapper.findAll('ion-app > [data-testid="toast-stack"]').map((each) => each.attributes('data-position'))).toEqual([
      'bottom',
      'top',
    ]);
    expect(wrapper.get('[data-testid="toast"]').text()).toContain('Product saved');
    wrapper.unmount();
  });

  it('paints toasts before anyone signs in too (the sign-in screen tells its errors with them)', async () => {
    const wrapper = await mountApp(undefined);
    toastSuccess('Link sent');
    await flushPromises();
    expect(wrapper.findAll('[data-testid="toast"]')).toHaveLength(1);
    wrapper.unmount();
  });
});
