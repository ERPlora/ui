import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toastError = vi.hoisted(() => vi.fn());
vi.mock('./toast', () => ({ toastError }));

import HubIcon from './HubIcon.vue';
import { applySurface } from './surface';
import { resetUserThemePreferences, setThemePersister, themeMode } from './theme';
import type { ShellUserMenu } from './user-menu';
import { me, mountApp, openApp, router, session } from './__tests__/app-shell';

beforeEach(openApp);

// The person at the top of the side menu is a button that opens an ion-popover with the project's
// entries, Help, the theme (light, dark, system) and Sign out.
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

  it('the menu hangs from the whole card, wherever it was clicked (the name, the email, the avatar)', async () => {
    // Ionic anchors a popover to `trigger || event.detail.ionShadowTarget || event.target`: the span
    // clicked put it right under the name, over the card's email line.
    session.value = me({ user: { id: 'u1', label: 'Laura Martín', email: 'laura@panaderialopez.es' } });
    const wrapper = mountApp(SAAS_MENU);
    await trigger(wrapper).get('.sidebar-user-name').trigger('click');
    await flushPromises();
    const event = wrapper.getComponent({ name: 'IonPopover' }).props('event') as CustomEvent<{ ionShadowTarget?: Element }>;
    expect(event.detail?.ionShadowTarget).toBe(trigger(wrapper).element);
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
