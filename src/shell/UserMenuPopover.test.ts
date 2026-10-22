import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
    // A route of this app is a button, never a link: no address, no new tab (the href entries are below).
    const row = wrapper.get('[data-testid="user-menu-account"]').element as HTMLElement & { href?: string; target?: string; rel?: string };
    expect([row.href, row.target, row.rel]).toEqual([undefined, undefined, undefined]);
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

// An entry that leaves the app (`href`): another project's page, as the hub's «My account» and «Report a
// problem» on erplora.com (APP-BASE-1). A browser opens it in a new tab, like «Upgrade plan»; the installed app
// opens nothing on `target=_blank`, so it hands the address to the system browser (`open_external_url`, which
// checks it is ours) and a refusal is said, never a button that does nothing.
describe('UserMenuPopover: an entry that leaves the app', () => {
  const REPORT = 'https://erplora.com/report-a-problem';
  const OUT: ShellUserMenu = {
    items: [{ id: 'report', labelKey: 'userMenu.help', icon: 'ion:chatbubbles-outline', href: REPORT }],
  };
  type TauriWindow = { __TAURI__?: { core: { invoke: (cmd: string, args?: unknown) => Promise<unknown> } } };

  afterEach(() => {
    delete (window as TauriWindow).__TAURI__;
  });

  function click(wrapper: ReturnType<typeof mountPopover>): MouseEvent {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    wrapper.get('[data-testid="user-menu-report"]').element.dispatchEvent(event);
    return event;
  }

  it('in a browser is a link to that address in a new tab, never a route of this app', async () => {
    const wrapper = mountPopover(OUT);
    // Vue hands them to ion-item as properties (it paints its own <a> from them), not as attributes.
    const row = wrapper.get('[data-testid="user-menu-report"]').element as HTMLElement & { href?: string; target?: string; rel?: string };
    expect([row.href, row.target, row.rel]).toEqual([REPORT, '_blank', 'noopener']);
    const event = click(wrapper);
    await flushPromises();
    expect(event.defaultPrevented).toBe(false);
    expect(router.currentRoute.value.path).toBe('/');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });

  it('in the installed app hands the address to the system browser instead', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    (window as TauriWindow).__TAURI__ = { core: { invoke } };
    const wrapper = mountPopover(OUT);
    const event = click(wrapper);
    await flushPromises();
    expect(event.defaultPrevented).toBe(true);
    expect(invoke).toHaveBeenCalledWith('open_external_url', { url: REPORT });
    expect(router.currentRoute.value.path).toBe('/');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('when the app cannot open it, says so', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    (window as TauriWindow).__TAURI__ = { core: { invoke: vi.fn().mockRejectedValue('external_url_refused') } };
    click(mountPopover(OUT));
    await flushPromises();
    expect(toastError).toHaveBeenCalledWith('Could not open that page. Try again.');
  });
});

// happy-dom lays nothing out, so this reads the stylesheet; the boxes are measured by the panel's e2e
// (saas tests/e2e/panel/accounts-flows.spec.ts, «the user menu reads whole»), at 390, 834 and 1440.
describe('polish.css: the user menu and its card read whole', () => {
  const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'theme/polish.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');

  /** The declarations of the top-level rule whose selector list is exactly `selector`. */
  function rule(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
    const found = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(CSS);
    return found ? found[1].trim() : '';
  }

  it('the theme buttons share a fixed 7.5rem, so «Theme» keeps its line in the 248px menu', () => {
    // `width: auto` let Ionic's buttons grow to 50px each (166px), leaving the label 18px: «Th/e/m/e».
    // The end slot is the only lever: a min-width on ion-label does not hold (hub#1733).
    expect(rule('.user-menu-theme ion-segment')).toBe('flex: none; width: 7.5rem;');
    expect(rule('.user-menu-theme ion-segment-button')).toBe('min-width: 0;');
  });

  it("the card's name and email are blocks, so a long one ends in «…» before the chevron", () => {
    // Inline spans ignore text-overflow: the address ran under the chevron and out of the menu.
    for (const line of ['.sidebar-user-name', '.sidebar-user-email']) {
      const declarations = rule(line);
      expect(declarations, line).toContain('display: block;');
      expect(declarations, line).toContain('overflow: hidden; text-overflow: ellipsis; white-space: nowrap;');
    }
  });
});
