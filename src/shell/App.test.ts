import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App.vue';
import HubIcon from './HubIcon.vue';
import { createShellI18n } from './i18n';
import { resolveIcon } from './icons';
import { SESSION_KEY, createShellSession, type SessionMe, type SessionStatus } from './session';
import { SHELL_CONFIG_KEY } from './shell-config';

type El = HTMLElement & Record<string, unknown>;

function me(overrides: Partial<SessionMe> = {}): SessionMe {
  return {
    user: { id: 'u1', label: 'Ana Pérez' },
    permissions: ['demo.view'],
    menu: [
      {
        id: 'general',
        label: 'General',
        items: [
          { path: '/demo/items', label: 'Items', icon: 'ion:cube-outline' },
          { path: '/demo/stats', label: 'Stats', icon: 'speedometer-outline' },
        ],
      },
      { id: 'account', label: 'Account', items: [{ path: '/settings', label: 'Settings', icon: 'ion:settings-outline' }] },
    ],
    apps: [{ label: 'Demo', state: 'on' }],
    language: 'en',
    ...overrides,
  };
}

let router: Router;
let session: ReturnType<typeof ref<SessionMe | undefined>>;

beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: { template: '<div />' } },
      { path: '/demo/items/:id?', component: { template: '<div />' }, meta: { auth: true } },
      { path: '/demo/stats', component: { template: '<div />' }, meta: { auth: true } },
      { path: '/launch', component: { template: '<div />' }, meta: { auth: true, chrome: false } },
    ],
  });
  session = ref<SessionMe | undefined>(me());
  await router.push('/demo/items/42');
});

function mountApp() {
  const shellSession = createShellSession(session, ref<SessionStatus>('live'));
  return mount(App, {
    global: {
      plugins: [router, createShellI18n({ locale: 'en' })],
      provide: { [SESSION_KEY as symbol]: shellSession, [SHELL_CONFIG_KEY as symbol]: { homePath: '/demo/items' } },
      stubs: { IonRouterOutlet: { template: '<div class="router-outlet-stub" />' } },
    },
  });
}

describe('App (shell root)', () => {
  it('is ion-app > ion-split-pane (lg, content main) > ion-menu + the router outlet #main', () => {
    const wrapper = mountApp();
    const pane = wrapper.get('ion-app > ion-split-pane').element as El;
    expect(pane.contentId).toBe('main');
    expect(pane.when).toBe('lg');
    const menu = wrapper.get('ion-split-pane > ion-menu');
    expect(menu.classes()).toContain('dash-menu');
    expect((menu.element as El).menuId).toBe('shell-navigation');
    expect((menu.element as El).contentId).toBe('main');
    expect((menu.element as El).type).toBe('overlay');
    expect(wrapper.get('ion-split-pane > .router-outlet-stub').attributes('id')).toBe('main');
  });

  it('paints the menu from base.session.me: one list per section, its items as root navigation', () => {
    const wrapper = mountApp();
    const headers = wrapper.findAll('ion-list.nav-list ion-list-header.nav-section-label').map((h) => h.text());
    expect(headers).toEqual(['General', 'Account']);
    const items = wrapper.findAll('ion-menu-toggle ion-item.nav-item');
    expect(items.map((i) => i.attributes('routerlink'))).toEqual(['/demo/items', '/demo/stats', '/settings']);
    // Stencil's slot patch hides `textContent` of ion-label under happy-dom: read its markup.
    expect(items.map((i) => i.get('ion-label.nav-label').element.innerHTML.trim())).toEqual(['Items', 'Stats', 'Settings']);
    for (const item of items) {
      expect((item.element as El).routerDirection).toBe('root');
      expect((item.element as El).detail).toBe(false);
    }
  });

  it('paints item icons with ion-icon by Ionicons name (registered with addIcons)', () => {
    const icons = mountApp().findAll('ion-item.nav-item ion-icon.nav-icon');
    expect(icons.map((i) => (i.element as El).name)).toEqual(['cube-outline', 'speedometer-outline', 'settings-outline']);
    expect(icons[0].attributes('slot')).toBe('start');
  });

  // An app's menu may name any registered set (`Nav(icon="mdi:cart")` in apps.py): `ion-icon`'s
  // `name` only knows Ionicons, so a `set:name` there painted nothing. HubIcon paints every set.
  it('paints a menu icon of any registered set through HubIcon (mdi:cart, lucide:lock)', async () => {
    session.value = me({
      menu: [
        {
          id: 'general',
          label: 'General',
          items: [
            { path: '/demo/items', label: 'Cart', icon: 'mdi:cart' },
            { path: '/demo/stats', label: 'Lock', icon: 'lucide:lock' },
          ],
        },
      ],
    });
    const wrapper = mountApp();
    await flushPromises();
    expect(wrapper.findAllComponents(HubIcon).map((i) => i.props('name'))).toEqual(['mdi:cart', 'lucide:lock']);
    const icons = wrapper.findAll('ion-item.nav-item ion-icon.nav-icon');
    expect(icons.map((i) => (i.element as El).icon)).toEqual([resolveIcon('mdi:cart'), resolveIcon('lucide:lock')]);
    expect(icons.map((i) => (i.element as El).name ?? '')).toEqual(['', '']);
    expect(icons[0].attributes('slot')).toBe('start');
  });

  it('marks the current section (also on its sub-paths)', () => {
    const [items, stats] = mountApp().findAll('ion-item.nav-item');
    expect(items.classes()).toContain('selected');
    expect(items.attributes('aria-current')).toBe('page');
    expect(stats.classes()).not.toContain('selected');
    expect(stats.attributes('aria-current')).toBeUndefined();
  });

  it('follows the live session: a new menu item appears without reloading', async () => {
    const wrapper = mountApp();
    session.value = me({
      menu: [{ id: 'general', label: 'General', items: [{ path: '/demo/new', label: 'New', icon: 'ion:add' }] }],
    });
    await flushPromises();
    expect(wrapper.findAll('ion-item.nav-item').map((i) => i.attributes('routerlink'))).toEqual(['/demo/new']);
  });

  it('shows who is signed in at the top of the menu', () => {
    const user = mountApp().get('ion-menu ion-header .sidebar-user');
    expect(user.get('.sidebar-user-avatar').text()).toBe('AP');
    expect(user.get('.sidebar-user-name').text()).toBe('Ana Pérez');
  });

  it('the brand in the menu footer goes Home', async () => {
    await router.push('/demo/stats');
    const wrapper = mountApp();
    await wrapper.get('ion-footer .brand-link').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/demo/items');
  });

  it('no menu without a user, nor on a screen that does not require a session (hub#925)', async () => {
    session.value = me({ user: null });
    expect(mountApp().find('ion-menu').exists()).toBe(false);

    session.value = me();
    await router.push('/login');
    const wrapper = mountApp();
    expect(wrapper.find('ion-menu').exists()).toBe(false);
    expect(wrapper.find('.router-outlet-stub').exists()).toBe(true);
  });

  it('no menu on a screen that paints its own frame (meta.chrome: false), even behind a session', async () => {
    await router.push('/launch');
    const wrapper = mountApp();
    expect(wrapper.find('ion-menu').exists()).toBe(false);
    expect(wrapper.find('.router-outlet-stub').exists()).toBe(true);

    await router.push('/demo/stats');
    await flushPromises();
    expect(wrapper.find('ion-menu').exists()).toBe(true);
  });

  it('mounts the split pane again when the person changes (hub#2539)', async () => {
    const wrapper = mountApp();
    const before = wrapper.get('ion-split-pane').element;
    session.value = me({ user: { id: 'u1', label: 'Ana P.' } });
    await flushPromises();
    expect(wrapper.get('ion-split-pane').element).toBe(before);
    session.value = me({ user: { id: 'u2', label: 'Luis' } });
    await flushPromises();
    expect(wrapper.get('ion-split-pane').element).not.toBe(before);
  });
});

