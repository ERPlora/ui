import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('./toast', () => ({ toastError }));

import { createShellI18n } from './i18n';
import { applySurface } from './surface';
import { resetUserThemePreferences, themeMode } from './theme';
import { type ShellUserMenu, USER_MENU_KEY } from './user-menu';
import UserMenuPopover from './UserMenuPopover.vue';

/** `ion-popover` presents itself only in a real browser: the stub shows its content while open. */
const PopoverStub = defineComponent({
  name: 'IonPopover',
  inheritAttrs: false,
  props: { isOpen: Boolean, event: { type: null, default: undefined } },
  emits: ['didDismiss'],
  setup(props, { slots, attrs, emit }) {
    return () =>
      props.isOpen
        ? h('div', { ...attrs, 'data-stub': 'ion-popover', onClick: (e: Event) => e.target === e.currentTarget && emit('didDismiss') }, slots.default?.())
        : null;
  },
});

const MENU: ShellUserMenu = {
  items: [
    { id: 'account', labelKey: 'userMenu.help', icon: 'ion:person-circle-outline', to: '/account' },
    { id: 'store', labelKey: 'userMenu.help', icon: 'ion:storefront-outline', to: '/store', webOnly: true },
  ],
  helpPath: '/help',
  logout: vi.fn(),
};

let router: Router;

beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/account', '/help', '/store'].map((path) => ({ path, component: { template: '<div />' } })),
  });
  await router.push('/');
});

afterEach(() => {
  toastError.mockReset();
  resetUserThemePreferences();
  applySurface('web');
});

function mountPopover(menu: ShellUserMenu = MENU, isOpen = true) {
  return mount(UserMenuPopover, {
    props: { isOpen },
    attrs: { class: 'sidebar-user-popover' },
    global: {
      plugins: [router, createShellI18n({ locale: 'en' })],
      provide: { [USER_MENU_KEY as symbol]: menu },
      stubs: { IonPopover: PopoverStub },
    },
  });
}

const rows = (wrapper: ReturnType<typeof mountPopover>) =>
  wrapper.findAll('[data-stub="ion-popover"] ion-item').map((row) => row.attributes('data-testid'));

describe('UserMenuPopover (the user menu, under the person at the top of the side menu)', () => {
  it("lists the project's entries, Help, the theme and Sign out; nothing while closed", () => {
    expect(rows(mountPopover())).toEqual([
      'user-menu-account',
      'user-menu-store',
      'user-menu-help',
      'user-menu-theme',
      'user-menu-logout',
    ]);
    expect(mountPopover(MENU, false).find('[data-stub="ion-popover"]').exists()).toBe(false);
  });

  it('takes the class of where it opens (the sidebar card)', () => {
    expect(mountPopover().get('[data-stub="ion-popover"]').classes()).toContain('sidebar-user-popover');
  });

  it('a web-only entry is not offered on the app surfaces', () => {
    applySurface('desktop');
    expect(rows(mountPopover())).not.toContain('user-menu-store');
  });

  it('an entry opens its route and asks to be closed', async () => {
    const wrapper = mountPopover();
    await wrapper.get('[data-testid="user-menu-account"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/account');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });

  it('the theme row applies the mode picked and keeps the menu open', async () => {
    const wrapper = mountPopover();
    await wrapper.get('[data-testid="user-menu-theme"] ion-segment').trigger('ionChange', { detail: { value: 'dark' } });
    expect(themeMode.value).toBe('dark');
    expect(wrapper.emitted('dismiss')).toBeUndefined();
  });

  it('Sign out asks to be closed and calls the logout; a failure says so', async () => {
    const logout = vi.fn().mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mountPopover({ logout });
    await wrapper.get('[data-testid="user-menu-logout"]').trigger('click');
    await flushPromises();
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
    expect(logout).toHaveBeenCalledOnce();
    expect(toastError).toHaveBeenCalledWith('Could not sign out. Try again.');
  });

  it('Ionic dismissing it (backdrop, Escape) asks to be closed too', async () => {
    const wrapper = mountPopover();
    await wrapper.get('[data-stub="ion-popover"]').trigger('click');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });
});
