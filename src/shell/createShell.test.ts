import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nextTick, ref } from 'vue';
import { createMemoryHistory } from 'vue-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<[string, unknown?]>);

vi.mock('./boot/trusted-types.boot', () => ({
  installTrustedTypesPolicy: () => calls.push(['installTrustedTypesPolicy']),
}));
vi.mock('ionicons', () => ({ addIcons: (icons: unknown) => calls.push(['addIcons', icons]) }));
vi.mock('./theme', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  bootTheme: () => calls.push(['bootTheme']),
}));
vi.mock('@ionic/vue', async (importOriginal) => ({
  ...((await importOriginal()) as object),
  IonicVue: { install: (_app: unknown, config: unknown) => calls.push(['IonicVue', config]) },
}));

import { createShell } from './createShell';
import { ION_ICONS } from './icons';
import { SESSION_KEY, type SessionMe, type SessionStatus } from './session';
import { SHELL_CONFIG_KEY } from './shell-config';

function me(language = 'es'): SessionMe {
  return { user: { id: 'u1', label: 'Ana' }, permissions: ['*'], menu: [], apps: [], language };
}

async function boot(language = 'es') {
  const session = ref<SessionMe | undefined>(me(language));
  const status = ref<SessionStatus>('live');
  const shell = await createShell({
    routes: [{ path: '/demo/items', component: { template: '<div />' }, meta: { auth: true } }],
    session,
    status,
    homePath: '/demo/items',
    messages: { en: { demo: { title: 'Items' } }, es: { demo: { title: 'Artículos' } } },
    history: createMemoryHistory(),
  });
  return { ...shell, session, status };
}

beforeEach(() => {
  calls.length = 0;
});

describe('createShell', () => {
  it('boots in the order of the Hub main.ts (hub#1060): policy, icons, Ionic, theme', async () => {
    await boot();
    expect(calls.map(([name]) => name)).toEqual(['installTrustedTypesPolicy', 'addIcons', 'IonicVue', 'bootTheme']);
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
