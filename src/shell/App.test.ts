import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('./toast', () => ({ toastError }));

import App from './App.vue';
import HubIcon from './HubIcon.vue';
import { createShellI18n } from './i18n';
import { resolveIcon } from './icons';
import { SESSION_KEY, createShellSession, type SessionMe, type SessionStatus } from './session';
import { type ShellConfig, SHELL_CONFIG_KEY } from './shell-config';
import { applySurface } from './surface';
import { resetUserThemePreferences, setThemePersister, themeMode } from './theme';
import { type ShellUserMenu, USER_MENU_KEY } from './user-menu';

/** `ion-popover` presents itself only in a real browser: the stub shows its content while open. */
const PopoverStub = defineComponent({
  name: 'IonPopover',
  inheritAttrs: false,
  props: { isOpen: Boolean, event: { type: null, default: undefined } },
  emits: ['didDismiss'],
  setup(props, { slots, attrs }) {
    return () => (props.isOpen ? h('div', { ...attrs, 'data-stub': 'ion-popover' }, slots.default?.()) : null);
  },
});

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
      { path: '/', component: { template: '<div />' }, meta: { auth: true } },
      { path: '/login', component: { template: '<div />' } },
      { path: '/demo/items/:id?', component: { template: '<div />' }, meta: { auth: true } },
      { path: '/demo/stats', component: { template: '<div />' }, meta: { auth: true } },
      { path: '/launch', component: { template: '<div />' }, meta: { auth: true, chrome: false } },
      { path: '/account', component: { template: '<div />' }, meta: { auth: true } },
      { path: '/help', component: { template: '<div />' }, meta: { auth: true } },
      { path: '/store', component: { template: '<div />' }, meta: { auth: true } },
    ],
  });
  session = ref<SessionMe | undefined>(me());
  await router.push('/demo/items/42');
});

function mountApp(
  userMenu?: ShellUserMenu,
  { locale = 'en', config = { homePath: '/demo/items' } }: { locale?: string; config?: ShellConfig } = {},
) {
  const shellSession = createShellSession(session, ref<SessionStatus>('live'));
  return mount(App, {
    global: {
      plugins: [
        router,
        createShellI18n({ locale, messages: { en: { account: { menu: 'Account' } }, es: { account: { menu: 'Cuenta' } } } }),
      ],
      provide: {
        [SESSION_KEY as symbol]: shellSession,
        [SHELL_CONFIG_KEY as symbol]: config,
        ...(userMenu ? { [USER_MENU_KEY as symbol]: userMenu } : {}),
      },
      stubs: { IonRouterOutlet: { template: '<div class="router-outlet-stub" />' }, IonPopover: PopoverStub },
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

// The user menu (mockups README §3: «usuario arriba»; PLAN-SAAS §3.6, point 1): the person at the top
// of the side menu is a button that opens an ion-popover with the project's entries (the SaaS:
// Account), Help, the theme (light, dark, system) and Sign out.
describe('App: user menu', () => {
  afterEach(() => {
    toastError.mockReset();
    setThemePersister(undefined);
    resetUserThemePreferences();
    applySurface('web');
  });

  const SAAS_MENU: ShellUserMenu = {
    items: [{ id: 'account', labelKey: 'account.menu', icon: 'ion:person-circle-outline', to: '/account' }],
    helpPath: '/help',
    logout: vi.fn(),
  };

  const trigger = (wrapper: ReturnType<typeof mountApp>) => wrapper.get('ion-menu ion-header button.sidebar-user');
  const popover = (wrapper: ReturnType<typeof mountApp>) => wrapper.find('[data-stub="ion-popover"].sidebar-user-popover');

  async function open(wrapper: ReturnType<typeof mountApp>) {
    await trigger(wrapper).trigger('click');
    await flushPromises();
  }

  it('shows the name and the email of the person; no email line without one', () => {
    session.value = me({ user: { id: 'u1', label: 'Laura Martín', email: 'laura@panaderialopez.es' } });
    const header = trigger(mountApp());
    expect(header.get('.sidebar-user-avatar').text()).toBe('LM');
    expect(header.get('.sidebar-user-name').text()).toBe('Laura Martín');
    expect(header.get('.sidebar-user-email').text()).toBe('laura@panaderialopez.es');

    session.value = me();
    expect(trigger(mountApp()).find('.sidebar-user-email').exists()).toBe(false);
  });

  it('is a named button that says it opens a dialog, and whether it is open', async () => {
    const wrapper = mountApp(SAAS_MENU);
    const button = trigger(wrapper);
    expect(button.attributes('type')).toBe('button');
    expect(button.attributes('aria-label')).toBe('User menu');
    expect(button.attributes('aria-haspopup')).toBe('dialog');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(popover(wrapper).exists()).toBe(false);

    await open(wrapper);
    expect(popover(wrapper).exists()).toBe(true);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true');
  });

  it('the card says it opens (a chevron) and the menu opens under it', async () => {
    const wrapper = mountApp(SAAS_MENU);
    expect(trigger(wrapper).getComponent(HubIcon).props('name')).toBe('ion:chevron-expand-outline');
    await open(wrapper);
    expect(popover(wrapper).attributes('side')).toBe('bottom');
    expect(popover(wrapper).attributes('alignment')).toBe('start');
  });

  it('Enter and Space on the card click it, which is what opens the menu (webviews do not always)', async () => {
    const wrapper = mountApp(SAAS_MENU);
    const clicks = vi.fn();
    trigger(wrapper).element.addEventListener('click', clicks);
    await trigger(wrapper).trigger('keydown', { key: 'Enter' });
    await trigger(wrapper).trigger('keydown', { key: ' ' });
    expect(clicks).toHaveBeenCalledTimes(2);
    await flushPromises();
    expect(popover(wrapper).exists()).toBe(true);
  });

  it("lists the project's entries, Help, the theme and Sign out, in that order, each with its icon", async () => {
    const wrapper = mountApp(SAAS_MENU);
    await open(wrapper);
    const rows = popover(wrapper).findAll('ion-item');
    expect(rows.map((row) => row.attributes('data-testid'))).toEqual([
      'user-menu-account',
      'user-menu-help',
      'user-menu-theme',
      'user-menu-logout',
    ]);
    expect(rows.map((row) => row.get('ion-label').element.innerHTML.trim())).toEqual(['Account', 'Help', 'Theme', 'Sign out']);
    expect(rows.map((row) => row.findComponent(HubIcon).exists() && row.findComponent(HubIcon).props('name'))).toEqual([
      'ion:person-circle-outline',
      'ion:help-circle-outline',
      'ion:contrast-outline',
      'ion:log-out-outline',
    ]);
  });

  it('an entry opens its route and closes the menu', async () => {
    const wrapper = mountApp(SAAS_MENU);
    await open(wrapper);
    await popover(wrapper).get('[data-testid="user-menu-account"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/account');
    expect(popover(wrapper).exists()).toBe(false);

    await open(wrapper);
    await popover(wrapper).get('[data-testid="user-menu-help"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/help');
  });

  it('the theme row picks light, dark or system, applies it, hands it to the persister and stays open', async () => {
    const persist = vi.fn();
    setThemePersister(persist);
    const wrapper = mountApp(SAAS_MENU);
    await open(wrapper);
    const segment = popover(wrapper).get('[data-testid="user-menu-theme"] ion-segment');
    expect((segment.element as HTMLElement & { value?: string }).value).toBe('system');
    const buttons = segment.findAll('ion-segment-button');
    expect(buttons.map((b) => [(b.element as HTMLElement & { value?: string }).value, b.attributes('aria-label')])).toEqual([
      ['light', 'Light'],
      ['dark', 'Dark'],
      ['system', 'System'],
    ]);
    expect(buttons.map((b) => b.findComponent(HubIcon).props('name'))).toEqual(['ion:sunny-outline', 'ion:moon-outline', 'ion:contrast-outline']);

    segment.element.dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'dark' } }));
    await flushPromises();
    expect(themeMode.value).toBe('dark');
    expect(document.documentElement.classList.contains('ion-palette-dark')).toBe(true);
    expect(persist).toHaveBeenCalledWith('dark');
    expect(popover(wrapper).exists()).toBe(true);
  });

  it('Sign out closes the menu and calls the logout of createShell', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const wrapper = mountApp({ ...SAAS_MENU, logout });
    await open(wrapper);
    await popover(wrapper).get('[data-testid="user-menu-logout"]').trigger('click');
    await flushPromises();
    expect(logout).toHaveBeenCalledTimes(1);
    expect(popover(wrapper).exists()).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('Sign out speaks the language of the person', async () => {
    const wrapper = mountApp(SAAS_MENU, { locale: 'es' });
    await open(wrapper);
    expect(popover(wrapper).get('[data-testid="user-menu-logout"] ion-label').element.innerHTML.trim()).toBe('Cerrar sesión');
  });

  it('a failed sign out says so, in the language of the person', async () => {
    const logout = vi.fn().mockRejectedValue(new Error('network down'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mountApp({ ...SAAS_MENU, logout });
    await open(wrapper);
    await popover(wrapper).get('[data-testid="user-menu-logout"]').trigger('click');
    await flushPromises();
    expect(toastError).toHaveBeenCalledWith('Could not sign out. Try again.');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('without a project menu there is only the theme: no Help nor Sign out it cannot honour', async () => {
    const wrapper = mountApp();
    await open(wrapper);
    expect(popover(wrapper).findAll('ion-item').map((row) => row.attributes('data-testid'))).toEqual(['user-menu-theme']);
  });

  it('a web-only entry is not offered on the app surfaces', async () => {
    applySurface('desktop');
    const wrapper = mountApp({ items: [{ id: 'store', labelKey: 'account.menu', icon: 'ion:storefront-outline', to: '/store', webOnly: true }] });
    await open(wrapper);
    expect(popover(wrapper).find('[data-testid="user-menu-store"]').exists()).toBe(false);
  });
});

// PLAN-SAAS §3.6 point 5: the SaaS marks the Store `webOnly`; inside the apps it is not in the menu.
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
