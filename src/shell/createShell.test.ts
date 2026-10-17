import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextTick, ref } from 'vue';
import { createMemoryHistory } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<[string, unknown?]>);

vi.mock('./boot/trusted-types.boot', () => ({
  installTrustedTypesPolicy: (...args: unknown[]) => calls.push(['installTrustedTypesPolicy', args]),
}));
vi.mock('ionicons', () => ({ addIcons: (icons: unknown) => calls.push(['addIcons', icons]) }));
vi.mock('./theme', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  bootTheme: (options: unknown) => calls.push(['bootTheme', options]),
}));
vi.mock('@ionic/vue', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  IonicVue: { install: (_app: unknown, config: unknown) => calls.push(['IonicVue', config]) },
}));

import { createShell, type CreateShellOptions } from './createShell';
import { ION_ICONS } from './icons';
import { SESSION_KEY, type SessionMe, type SessionStatus } from './session';
import { SHELL_CONFIG_KEY } from './shell-config';
import { applySurface, IN_APP_CLASS } from './surface';
import { USER_MENU_KEY } from './user-menu';

function me(language = 'es'): SessionMe {
  return { user: { id: 'u1', label: 'Ana' }, permissions: ['*'], menu: [], apps: [], language };
}

async function boot(language = 'es', extra: Partial<CreateShellOptions> = {}) {
  const session = ref<SessionMe | undefined>(me(language));
  const status = ref<SessionStatus>('live');
  const shell = await createShell({
    routes: [{ path: '/demo/items', component: { template: '<div />' }, meta: { auth: true } }],
    session,
    status,
    homePath: '/demo/items',
    messages: { en: { demo: { title: 'Items' } }, es: { demo: { title: 'Artículos' } } },
    history: createMemoryHistory(),
    ...extra,
  });
  return { ...shell, session, status };
}

beforeEach(() => {
  calls.length = 0;
});

const provides = (app: { _context: { provides: unknown } }) => app._context.provides as Record<symbol, unknown>;

afterEach(() => {
  applySurface('web');
});

describe('createShell', () => {
  it('boots in the order of the Hub main.ts (hub#1060): policy, icons, Ionic, theme', async () => {
    await boot();
    expect(calls.map(([name]) => name)).toEqual(['installTrustedTypesPolicy', 'addIcons', 'IonicVue', 'bootTheme']);
  });

  it('hands the Trusted Types policy the script origins the project trusts; none by default', async () => {
    const scriptOrigins = () => (calls.find(([name]) => name === 'installTrustedTypesPolicy')?.[1] as unknown[])[2];
    await boot();
    expect(scriptOrigins()).toEqual([]);
    calls.length = 0;
    await boot('es', { trustedScriptOrigins: ['https://js.stripe.com'] });
    expect(scriptOrigins()).toEqual(['https://js.stripe.com']);
  });

  it('registers every Ionicons icon of the shell so ion-icon name= paints offline and under the CSP', async () => {
    await boot();
    expect(calls.find(([name]) => name === 'addIcons')?.[1]).toBe(ION_ICONS);
  });

  it('pins IonicVue to ios mode with swipe-back off (ADR-0143)', async () => {
    await boot();
    expect(calls.find(([name]) => name === 'IonicVue')?.[1]).toEqual({ mode: 'ios', swipeBackEnabled: false });
  });

  it('returns the app NOT mounted (the entry mounts after router.isReady()) and its router', async () => {
    const { app, router } = await boot();
    expect(app._container).toBeNull();
    expect(app.config.globalProperties.$router).toBe(router);
    expect(router.resolve('/demo/items').meta.auth).toBe(true);
    expect(router.resolve('/no/such/page').name).toBe('not-found');
  });

  it('provides the session and the shell config app-wide', async () => {
    const { app } = await boot();
    const provides = app._context.provides as Record<symbol, unknown>;
    const session = provides[SESSION_KEY as symbol] as { user: { value: unknown } };
    expect(session.user.value).toEqual({ id: 'u1', label: 'Ana' });
    expect(provides[SHELL_CONFIG_KEY as symbol]).toEqual({ homePath: '/demo/items' });
  });

  it('speaks the session language, with the app catalogues merged, and follows it live', async () => {
    const { app, session } = await boot('es');
    const t = app.config.globalProperties.$t as (key: string) => string;
    expect(t('topbar.back')).toBe('Atrás');
    expect(t('demo.title')).toBe('Artículos');
    expect(document.documentElement.lang).toBe('es');
    session.value = me('en');
    await nextTick();
    expect(t('demo.title')).toBe('Items');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('createShell: surface, contrast and user menu', () => {
  it('marks <html> with the surface it runs on: the web in a browser', async () => {
    document.documentElement.removeAttribute('data-surface');
    await boot();
    expect(document.documentElement.dataset.surface).toBe('web');
    expect(document.documentElement.classList.contains(IN_APP_CLASS)).toBe(false);
  });

  it('takes the surface the entry knows (spa-config), and off the web sets html.in-app-shell', async () => {
    await boot('es', { surface: 'desktop' });
    expect(document.documentElement.dataset.surface).toBe('desktop');
    expect(document.documentElement.classList.contains(IN_APP_CLASS)).toBe(true);
  });

  it('boots the theme with the contrast it is given; the default is the theme\'s own', async () => {
    await boot();
    expect(calls.find(([name]) => name === 'bootTheme')?.[1]).toEqual({ contrast: undefined });
    calls.length = 0;
    await boot('es', { contrast: 'aa' });
    expect(calls.find(([name]) => name === 'bootTheme')?.[1]).toEqual({ contrast: 'aa' });
  });

  it('provides the user menu of the project app-wide (none: only the theme)', async () => {
    const logout = vi.fn();
    const { app } = await boot('es', { userMenu: { helpPath: '/help', logout } });
    const provided = (app._context.provides as Record<symbol, unknown>)[USER_MENU_KEY as symbol] as { helpPath?: string; logout?: unknown };
    expect(provided.helpPath).toBe('/help');
    expect(provided.logout).toBe(logout);
    const bare = await boot();
    expect((bare.app._context.provides as Record<symbol, unknown>)[USER_MENU_KEY as symbol]).toEqual({});
  });
});

// The shell's Home (HomePage at `/`, «Home» first in the menu) is the hub's: the SaaS has its own
// landing and a menu of its own, so it stays off unless the project asks for it.
describe('createShell: home', () => {
  it('home: true serves the shell Home at / and tells the menu to paint «Home» first', async () => {
    const { app, router } = await boot('es', { home: true });
    expect(router.resolve('/').name).toBe('home');
    expect(provides(app)[SHELL_CONFIG_KEY as symbol]).toEqual({ homePath: '/demo/items', home: true });
  });

  it('off by default: / is not the shell Home and the menu has no «Home»', async () => {
    const { app, router } = await boot();
    expect(router.hasRoute('home')).toBe(false);
    expect((provides(app)[SHELL_CONFIG_KEY as symbol] as { home?: boolean }).home).toBeFalsy();
  });
});

// FIX-SHELL-SPLIT-PANE (PLAN-MIGRATIONS §16): the hub's side menu is the old hub's (`sidebar`: the
// platform's entries, the QR in the footer, the rail); the SaaS keeps the menu of its session.
describe('createShell: sidebar', () => {
  const SIDEBAR = { groups: [[{ id: 'employees', labelKey: 'sidebar.employees', icon: 'ion:people-outline', to: '/employees' }]] };

  it('is provided app-wide, next to the rest of the config', async () => {
    const { app } = await boot('es', { home: true, sidebar: SIDEBAR });
    expect(provides(app)[SHELL_CONFIG_KEY as symbol]).toEqual({ homePath: '/demo/items', home: true, sidebar: SIDEBAR });
  });

  it('unset by default: the menu of the session, as the SaaS has it', async () => {
    const { app } = await boot();
    expect(provides(app)[SHELL_CONFIG_KEY as symbol]).toEqual({ homePath: '/demo/items' });
  });
});

describe('createShell.ts import order', () => {
  it('loads the theme in cascade order, every sheet our own or Ionic: nothing from OutfitKit (PLAN §16.11)', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'createShell.ts'), 'utf8');
    const sheets = [...source.matchAll(/^import '([^']+\.css)';$/gm)].map((m) => m[1]);
    expect(sheets.length).toBeGreaterThan(10);
    expect(sheets.filter((sheet) => !sheet.startsWith('./theme/') && !sheet.startsWith('@ionic/vue/css/'))).toEqual([]);
    const order = ['print', 'variables', 'palettes', 'erplora-logo', 'tabbar', 'polish', 'global'].map((sheet) =>
      source.indexOf(`import './theme/${sheet}.css';`),
    );
    expect(order.every((at) => at > -1), String(order)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('imports the boot hooks before anything that registers Ionic elements (hub#1060)', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'createShell.ts'), 'utf8');
    const ionic = source.indexOf("from '@ionic/vue'");
    const app = source.indexOf("from './App.vue'");
    expect(ionic).toBeGreaterThan(0);
    for (const hook of ['ionic-fill', 'ionic-select-text', 'ionic-select-interface']) {
      const at = source.indexOf(`import './boot/${hook}.boot';`);
      expect(at, hook).toBeGreaterThan(-1);
      expect(at, hook).toBeLessThan(ionic);
      expect(at, hook).toBeLessThan(app);
    }
  });
});
