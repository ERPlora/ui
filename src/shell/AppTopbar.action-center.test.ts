import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

import AppTopbar from './AppTopbar.vue';
import { createShellI18n } from './i18n';
import { createShellSession, SESSION_KEY } from './session';
import { SHELL_CONFIG_KEY } from './shell-config';

const ProjectPiece = defineComponent({ template: '<button data-testid="project-topbar">Project</button>' });

async function mountTopbar(
  actionNotices?: () => { notices: ReturnType<typeof ref<never[]>>; failed: ReturnType<typeof ref<boolean>> },
  { auth = true }: { auth?: boolean } = {},
) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' }, meta: { auth } }] });
  await router.push('/');
  const me = { user: { id: 'u1', label: 'Ana' }, permissions: [], menu: [], apps: [], language: 'en' };
  return mount(AppTopbar, {
    props: { title: 'Home' },
    global: {
      plugins: [router, createShellI18n({ locale: 'en' })],
      provide: {
        [SESSION_KEY as symbol]: createShellSession(ref(me), ref('live')),
        [SHELL_CONFIG_KEY as symbol]: { homePath: '/', actionNotices, chrome: { topbar: ProjectPiece } },
      },
    },
  });
}

describe('AppTopbar: action center', () => {
  it('paints the bell after the project chrome when actionNotices is configured', async () => {
    const actionNotices = () => ({ notices: ref([]), failed: ref(false) });
    const wrapper = await mountTopbar(actionNotices);
    const order = wrapper
      .get('ion-buttons[slot="end"]')
      .findAll('[data-testid="project-topbar"], [data-testid="action-bell"]')
      .map((el) => el.attributes('data-testid'));
    expect(order).toEqual(['project-topbar', 'action-bell']);
  });

  it('paints no bell at any size without actionNotices', async () => {
    for (const phone of [true, false]) {
      vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: phone, addEventListener: () => {}, removeEventListener: () => {} } as unknown as MediaQueryList);
      const wrapper = await mountTopbar();
      expect(wrapper.find('[data-testid="action-bell"]').exists()).toBe(false);
      wrapper.unmount();
    }
  });

  it('paints no bell on a screen without the authenticated chrome', async () => {
    const wrapper = await mountTopbar(() => ({ notices: ref([]), failed: ref(false) }), { auth: false });
    expect(wrapper.find('[data-testid="action-bell"]').exists()).toBe(false);
  });
});
