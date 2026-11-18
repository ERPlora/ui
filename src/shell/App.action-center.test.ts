import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IonModalStub } from '../components/FormModal/__tests__/ionModalStub';
import App from './App.vue';
import { createShellI18n } from './i18n';
import { createShellSession, SESSION_KEY, type SessionMe } from './session';
import { SHELL_CONFIG_KEY } from './shell-config';

function person(id: string): SessionMe {
  return { user: { id, label: id }, permissions: [], menu: [], apps: [], language: 'en' };
}

async function mountApp(withNotices: boolean, signedIn: SessionMe | null = person('ana')) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  await router.push('/');
  const me = ref<SessionMe | undefined>(signedIn ?? undefined);
  const actionNotices = vi.fn(() => ({ notices: ref([]), failed: ref(false) }));
  const wrapper = mount(App, {
    global: {
      plugins: [router, createShellI18n({ locale: 'en' })],
      provide: {
        [SESSION_KEY as symbol]: createShellSession(me, ref('live')),
        [SHELL_CONFIG_KEY as symbol]: { homePath: '/', actionNotices: withNotices ? actionNotices : undefined },
      },
      stubs: { IonRouterOutlet: { template: '<div />' }, IonModal: IonModalStub },
    },
  });
  return { wrapper, actionNotices, me };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('App: action center', () => {
  it('mounts one layer beside the toast stack when actionNotices is configured', async () => {
    const { wrapper, actionNotices } = await mountApp(true);
    expect(actionNotices).toHaveBeenCalledOnce();
    expect(wrapper.findAll('[data-testid="action-panel"]')).toHaveLength(1);
    expect(wrapper.findAll('.action-arrival-layer')).toHaveLength(1);
    expect(wrapper.find('[data-testid="toast-stack"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('changes nothing when the project has no action notices', async () => {
    const { wrapper } = await mountApp(false);
    expect(wrapper.find('[data-testid="action-panel"]').exists()).toBe(false);
    expect(wrapper.find('.action-arrival-layer').exists()).toBe(false);
    expect(wrapper.find('[data-testid="toast-stack"]').exists()).toBe(true);
    wrapper.unmount();
  });

  // The notices are a person's: nobody signed in reads none, and the next person starts from their own source.
  it('connects the source only while a person is signed in, and again for the next person', async () => {
    const { wrapper, actionNotices, me } = await mountApp(true, null);
    expect(actionNotices).not.toHaveBeenCalled();
    expect(wrapper.find('[data-testid="action-panel"]').exists()).toBe(false);
    me.value = person('ana');
    await flushPromises();
    expect(actionNotices).toHaveBeenCalledOnce();
    me.value = person('luis');
    await flushPromises();
    expect(actionNotices).toHaveBeenCalledTimes(2);
    expect(wrapper.findAll('[data-testid="action-panel"]')).toHaveLength(1);
    wrapper.unmount();
  });
});
