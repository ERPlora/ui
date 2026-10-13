import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory } from 'vue-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

const ionicCreateRouter = vi.hoisted(() => ({ calls: 0 }));
vi.mock('@ionic/vue-router', async (importOriginal) => {
  const original = (await importOriginal()) as typeof import('@ionic/vue-router');
  return {
    ...original,
    createRouter: (...args: Parameters<typeof original.createRouter>) => {
      ionicCreateRouter.calls += 1;
      return original.createRouter(...args);
    },
  };
});

import { createShellSession, type SessionMe, type SessionStatus } from './session';
import { createShellRouter, HOME_ROUTE, NOT_FOUND_ROUTE, NOT_IN_APP_ROUTE } from './router';
import { applySurface } from './surface';

const Page = { template: '<div />' };

function me(user: SessionMe['user']): SessionMe {
  return { user, permissions: [], menu: [], apps: [], language: 'en' };
}

function setup(data: SessionMe | undefined, status: SessionStatus = 'live', loginPath?: string) {
  const sessionMe = ref<SessionMe | undefined>(data);
  const sessionStatus = ref<SessionStatus>(status);
  const redirect = vi.fn();
  const router = createShellRouter(
    [
      { path: '/', component: Page },
      { path: '/demo/items', name: 'items', component: Page, meta: { auth: true } },
    ],
    { session: createShellSession(sessionMe, sessionStatus), history: createMemoryHistory(), redirect, loginPath },
  );
  return { router, redirect, sessionMe, sessionStatus };
}

describe('createShellRouter', () => {
  it("is Ionic's router (IonRouterOutlet needs it to stack and animate pages)", () => {
    const before = ionicCreateRouter.calls;
    setup(me({ id: 'u1', label: 'Ana' }));
    expect(ionicCreateRouter.calls).toBe(before + 1);
  });

  it('keeps the app routes and appends the catch-all LAST (hub#1723: a 404 screen, not a redirect)', () => {
    const { router } = setup(me({ id: 'u1', label: 'Ana' }));
    const records = router.getRoutes();
    expect(records.map((r) => r.path)).toContain('/demo/items');
    expect(router.resolve('/demo/items').name).toBe('items');
    const missing = router.resolve('/tpv/whatever');
    expect(missing.name).toBe('not-found');
    expect(missing.meta.auth).toBe(true);
    expect(NOT_FOUND_ROUTE.path).toBe('/:pathMatch(.*)*');
  });

  // After the login `safe_next` falls back to `/`: without a page there, a hub with no app opened
  // on the 404. The shell's Home is the hub's (`home: true`); the SaaS has its own landing.
  it("with home, serves the shell's Home at / behind a session, before the catch-all", async () => {
    const router = createShellRouter([{ path: '/demo/items', component: Page, meta: { auth: true } }], {
      session: createShellSession(ref<SessionMe | undefined>(me({ id: 'u1', label: 'Ana' })), ref<SessionStatus>('live')),
      history: createMemoryHistory(),
      redirect: vi.fn(),
      home: true,
    });
    expect(HOME_ROUTE.path).toBe('/');
    expect(router.resolve('/').name).toBe('home');
    expect(router.resolve('/').meta.auth).toBe(true);
    expect(router.resolve('/nowhere').name).toBe('not-found');
    await router.push('/');
    const component = router.currentRoute.value.matched[0].components?.default as { __name?: string };
    expect(component.__name).toBe('HomePage');
  });

  it('without home (the default, the SaaS), / is not the shell Home', () => {
    const router = createShellRouter([{ path: '/demo/items', component: Page, meta: { auth: true } }], {
      session: createShellSession(ref<SessionMe | undefined>(me({ id: 'u1', label: 'Ana' })), ref<SessionStatus>('live')),
      history: createMemoryHistory(),
      redirect: vi.fn(),
    });
    expect(router.hasRoute('home')).toBe(false);
    expect(router.resolve('/').name).toBe('not-found');
  });

  it('an app route at / wins over the shell Home', () => {
    const router = createShellRouter([{ path: '/', component: Page }], {
      session: createShellSession(ref<SessionMe | undefined>(me({ id: 'u1', label: 'Ana' })), ref<SessionStatus>('live')),
      history: createMemoryHistory(),
      redirect: vi.fn(),
      home: true,
    });
    const home = router.resolve('/');
    expect(home.name).toBeUndefined();
    expect(home.matched[0].components?.default).toBe(Page);
  });

  it('an unknown address keeps the URL and mounts the 404 page', async () => {
    const { router } = setup(me({ id: 'u1', label: 'Ana' }));
    await router.push('/sales?x=1');
    expect(router.currentRoute.value.fullPath).toBe('/sales?x=1');
    expect(router.currentRoute.value.name).toBe('not-found');
    // vue-router swaps the lazy loader for the loaded component once it navigated.
    const component = router.currentRoute.value.matched[0].components?.default as { __name?: string };
    expect(component.__name).toBe('NotFoundPage');
  });
});

describe('authGate', () => {
  it('lets anyone through a route that does not require a session', async () => {
    const { router, redirect } = setup(me(null));
    await router.push('/');
    expect(router.currentRoute.value.path).toBe('/');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('lets a signed-in person through a route with meta.auth', async () => {
    const { router, redirect } = setup(me({ id: 'u1', label: 'Ana' }));
    await router.push('/demo/items');
    expect(router.currentRoute.value.path).toBe('/demo/items');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('without a user, leaves the SPA for the login page with next= and cancels the navigation', async () => {
    const { router, redirect } = setup(me(null));
    await router.push('/');
    await router.push('/demo/items?q=a&page=2');
    expect(redirect).toHaveBeenCalledWith('/login?next=%2Fdemo%2Fitems%3Fq%3Da%26page%3D2');
    expect(router.currentRoute.value.path).toBe('/');
  });

  it('the login path is configurable (phase 1: Django admin login)', async () => {
    const { router, redirect } = setup(me(null), 'live', '/admin/login/');
    await router.push('/nope');
    expect(redirect).toHaveBeenCalledWith('/admin/login/?next=%2Fnope');
  });

  it('a login URL with its own query gets next= appended with & (the SaaS login of a hub)', async () => {
    const { router, redirect } = setup(me(null), 'live', 'http://hub.localhost:8001/hub-login/?hub=a');
    await router.push('/demo/items?q=a');
    expect(redirect).toHaveBeenCalledWith('http://hub.localhost:8001/hub-login/?hub=a&next=%2Fdemo%2Fitems%3Fq%3Da');
  });

  it('waits for base.session.me before deciding (hub#858: no login for a session still arriving)', async () => {
    const { router, redirect, sessionMe, sessionStatus } = setup(undefined, 'loading');
    let done = false;
    void router.push('/demo/items').then(() => (done = true));
    await flushPromises();
    expect(done).toBe(false);
    sessionMe.value = me({ id: 'u1', label: 'Ana' });
    sessionStatus.value = 'live';
    await flushPromises();
    expect(done).toBe(true);
    expect(router.currentRoute.value.path).toBe('/demo/items');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('defaults to a full-page redirect through window.location', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    const router = createShellRouter([{ path: '/demo/items', component: Page, meta: { auth: true } }], {
      session: createShellSession(ref<SessionMe | undefined>(me(null)), ref<SessionStatus>('live')),
      history: createMemoryHistory(),
    });
    await router.push('/demo/items');
    expect(assign).toHaveBeenCalledWith('/login?next=%2Fdemo%2Fitems');
    vi.unstubAllGlobals();
  });
});

// A route that sells (`meta.webOnly`, the SaaS's Store) is not in the apps (PLAN-SAAS §3.6, point 5):
// a deep link to it, on an app surface, keeps the address and mounts the neutral page instead.
describe('web-only routes', () => {
  afterEach(() => applySurface('web'));

  function setupStore() {
    return createShellRouter(
      [
        { path: '/businesses', name: 'businesses', component: Page, meta: { auth: true } },
        { path: '/store/:tab?', name: 'store', component: Page, meta: { auth: true, webOnly: true } },
      ],
      {
        session: createShellSession(ref<SessionMe | undefined>(me({ id: 'u1', label: 'Ana' })), ref<SessionStatus>('live')),
        history: createMemoryHistory(),
        redirect: vi.fn(),
      },
    );
  }

  it('open on the web', async () => {
    const router = setupStore();
    await router.push('/store/plans');
    expect(router.currentRoute.value.name).toBe('store');
  });

  it('on every app surface: the same address, the not-in-app page', async () => {
    for (const surface of ['desktop', 'mobile', 'account'] as const) {
      applySurface(surface);
      const router = setupStore();
      await router.push('/store/plans?hub=42#modules');
      expect(router.currentRoute.value.fullPath, surface).toBe('/store/plans?hub=42#modules');
      expect(router.currentRoute.value.name, surface).toBe('not-in-app');
    }
    const router = setupStore();
    applySurface('desktop');
    await router.push('/store');
    const component = router.currentRoute.value.matched[0].components?.default as { __name?: string };
    expect(component.__name).toBe('NotInAppPage');
  });

  it('routes that do not sell are untouched, and an unknown address is still the 404', async () => {
    applySurface('mobile');
    const router = setupStore();
    await router.push('/businesses');
    expect(router.currentRoute.value.name).toBe('businesses');
    await router.push('/nowhere');
    expect(router.currentRoute.value.name).toBe('not-found');
  });

  it('the not-in-app route is behind a session too and never catches an address by itself', () => {
    expect(NOT_IN_APP_ROUTE.meta?.auth).toBe(true);
    expect(NOT_IN_APP_ROUTE.name).toBe('not-in-app');
  });
});
