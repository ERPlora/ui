import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

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
import { createShellRouter, NOT_FOUND_ROUTE } from './router';

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
