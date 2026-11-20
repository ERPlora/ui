import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import HubIcon from './HubIcon.vue';
import { resolveIcon } from './icons';
import type { SessionMe } from './session';
import type { ShellConfig } from './shell-config';
import { applySurface } from './surface';
import { type El, me, mountApp, openApp, router, session } from './__tests__/app-shell';

beforeEach(openApp);

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
    expect(items.map((item) => [item.attributes('aria-label'), item.attributes('title')])).toEqual([
      ['Items', 'Items'],
      ['Stats', 'Stats'],
      ['Settings', 'Settings'],
    ]);
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
    // Scoped to the menu items: the user button carries its own chevron (HubIcon) too.
    expect(wrapper.findAll('ion-item.nav-item').map((i) => i.getComponent(HubIcon).props('name'))).toEqual(['mdi:cart', 'lucide:lock']);
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

  it('no menu without a user, nor on a screen that does not require a session', async () => {
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

  it('mounts the split pane again when the person changes', async () => {
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

// The shell's Home (`createShell({ home: true })`, the hub): the apps of the hub as a grid at `/`
// (HomePage) and «Home» first in the menu, the way back to it from any screen. The SaaS has none.
describe('App: Home', () => {
  const HUB: ShellConfig = { homePath: '/', home: true };

  /** The entries of the server's menu sections (the fixed Home entry above them is not one). */
  const sectionItems = (wrapper: ReturnType<typeof mountApp>) =>
    wrapper.findAll('ion-list.nav-list:not(.nav-home) ion-menu-toggle ion-item.nav-item');

  it('opens with Home, the way back to the apps grid, marked only on Home itself', async () => {
    const wrapper = mountApp(undefined, { config: HUB });
    const home = wrapper.get('ion-list.nav-list.nav-home ion-menu-toggle ion-item.nav-item[data-testid="nav-home"]');
    expect(home.attributes('routerlink')).toBe('/');
    expect((home.element as El).routerDirection).toBe('root');
    expect((home.element as El).detail).toBe(false);
    expect(home.get('ion-label.nav-label').element.innerHTML.trim()).toBe('Home');
    expect(home.getComponent(HubIcon).props('name')).toBe('ion:home-outline');
    expect(home.classes()).not.toContain('selected');
    expect(sectionItems(wrapper).map((i) => i.attributes('routerlink'))).toEqual(['/demo/items', '/demo/stats', '/settings']);

    await router.push('/');
    await flushPromises();
    expect(home.classes()).toContain('selected');
    expect(home.attributes('aria-current')).toBe('page');
    expect(sectionItems(wrapper).some((item) => item.classes().includes('selected'))).toBe(false);

    const es = mountApp(undefined, { config: HUB, locale: 'es' }).get('[data-testid="nav-home"] ion-label');
    expect(es.element.innerHTML.trim()).toBe('Inicio');
  });

  it('without the shell Home (the SaaS), the menu is the server sections alone', () => {
    const wrapper = mountApp(undefined, { config: { homePath: '/' } });
    expect(wrapper.find('[data-testid="nav-home"]').exists()).toBe(false);
    expect(wrapper.find('ion-list.nav-home').exists()).toBe(false);
  });
});

// The SaaS marks the Store `webOnly`: inside the apps it is not in the menu.
describe('App: navigation on the app surfaces', () => {
  afterEach(() => applySurface('web'));

  const SAAS = (): SessionMe =>
    me({
      menu: [
        {
          id: 'main',
          label: '',
          items: [
            { path: '/demo/items', label: 'Businesses', icon: 'ion:storefront-outline' },
            { path: '/store', label: 'Store', icon: 'ion:cart-outline', webOnly: true },
            { path: '/account', label: 'Account', icon: 'ion:person-circle-outline' },
          ],
        },
        { id: 'shop', label: 'Shop', items: [{ path: '/store', label: 'Store', icon: 'ion:cart-outline', webOnly: true }] },
      ],
    });

  const paths = (wrapper: ReturnType<typeof mountApp>) => wrapper.findAll('ion-item.nav-item').map((i) => i.attributes('routerlink'));

  it('paints web-only entries on the web', () => {
    session.value = SAAS();
    expect(paths(mountApp())).toEqual(['/demo/items', '/store', '/account', '/store']);
  });

  it('hides web-only entries on every app surface, and a section left empty', () => {
    session.value = SAAS();
    for (const surface of ['desktop', 'mobile', 'account'] as const) {
      applySurface(surface);
      const wrapper = mountApp();
      expect(paths(wrapper), surface).toEqual(['/demo/items', '/account']);
      expect(wrapper.findAll('ion-list.nav-list'), surface).toHaveLength(1);
    }
  });

  it('follows the surface live', async () => {
    session.value = SAAS();
    const wrapper = mountApp();
    applySurface('mobile');
    await flushPromises();
    expect(paths(wrapper)).toEqual(['/demo/items', '/account']);
  });

  it('a section without a label paints no divider header (the SaaS has one section)', () => {
    session.value = SAAS();
    const lists = mountApp().findAll('ion-list.nav-list');
    expect(lists[0].find('ion-list-header').exists()).toBe(false);
    expect(lists[1].get('ion-list-header').text()).toBe('Shop');
  });
});
