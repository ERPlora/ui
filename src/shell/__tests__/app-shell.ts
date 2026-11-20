// The shell root (App.vue) as its tests mount it. `openApp` (a `beforeEach`) gives every test a fresh router, on
// /demo/items/42, and a fresh live session of Ana Pérez; `router` and `session` are the running test's.
import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { ref } from 'vue';

import App from '../App.vue';
import { createShellI18n } from '../i18n';
import { SESSION_KEY, createShellSession, type SessionMe, type SessionStatus } from '../session';
import { type ShellConfig, SHELL_CONFIG_KEY } from '../shell-config';
import { type ShellUserMenu, USER_MENU_KEY } from '../user-menu';
import { IonPopoverStub } from './ionPopoverStub';

export type El = HTMLElement & Record<string, unknown>;

export function me(overrides: Partial<SessionMe> = {}): SessionMe {
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

export let router: Router;
export let session: ReturnType<typeof ref<SessionMe | undefined>>;

export async function openApp(): Promise<void> {
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
}

export function mountApp(
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
      stubs: { IonRouterOutlet: { template: '<div class="router-outlet-stub" />' }, IonPopover: IonPopoverStub },
    },
  });
}
