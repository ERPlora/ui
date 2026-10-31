// gh:hub#438 — after a deploy, a tap on a screen not opened yet in that tab did nothing and said nothing. Every screen
// is a lazy chunk with a hashed name (`/static/spa/assets/<Page>-<hash>.js`); the new image no longer serves the old
// tab's names, its `import()` fails, and the router aborted the navigation in silence (no `onError` anywhere). Through
// the REAL shell router, at the place where the tap went nowhere.
import { flushPromises } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, type RouteRecordRaw } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => vi.fn());
vi.mock('./toast', () => ({ toast }));

import { createShellRouter } from './router';
import { createShellSession, type SessionMe, type SessionStatus } from './session';

const Page = { template: '<div />' };

/** Chromium's words for a module file that never arrived (a 404 after a deploy, or a network that dropped). */
const lostChunk = () =>
  new TypeError('Failed to fetch dynamically imported module: http://localhost:3000/static/spa/assets/VerifactuPage-0ld.js');

function me(): SessionMe {
  return { user: { id: 'u1', label: 'Ana' }, permissions: [], menu: [], apps: [], language: 'en' };
}

function setup(failure: () => unknown = lostChunk, extra: RouteRecordRaw[] = []) {
  const redirect = vi.fn();
  const router = createShellRouter(
    [
      { path: '/', component: Page, meta: { auth: true } },
      { path: '/verifactu', component: () => Promise.reject(failure()), meta: { auth: true } },
      { path: '/sale/charge', component: () => Promise.reject(failure()), meta: { auth: true } },
      ...extra,
    ],
    {
      session: createShellSession(ref<SessionMe | undefined>(me()), ref<SessionStatus>('live')),
      history: createMemoryHistory(),
      redirect,
      home: true,
    },
  );
  return { router, redirect };
}

/** A tap that navigates inside the open hub (a tile, the side menu, a link, a page's own `push`). */
async function tap(router: ReturnType<typeof setup>['router'], to: string): Promise<void> {
  await router.push(to).catch(() => undefined);
  await flushPromises();
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  document.documentElement.lang = 'en';
});

afterEach(() => {
  toast.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('a screen whose file is gone after a deploy (gh:hub#438)', () => {
  it('opens in a fresh document, which gets the new names, instead of doing nothing', async () => {
    const { router, redirect } = setup();
    await router.push('/');
    await tap(router, '/verifactu');
    expect(redirect).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith('/verifactu');
    expect(toast).not.toHaveBeenCalled();
  });

  it('keeps what the tap asked for: the query and the fragment travel with it (Tables › «Charge»)', async () => {
    const { router, redirect } = setup();
    await router.push('/');
    await tap(router, '/sale/charge?ticket=7#pay');
    expect(redirect).toHaveBeenCalledWith('/sale/charge?ticket=7#pay');
  });

  // Each engine words it its own way, and Vite's preload helper adds one for the stylesheet half of a chunk.
  it.each([
    ['Chromium', 'Failed to fetch dynamically imported module: http://localhost:3000/static/spa/assets/A-1.js'],
    ['Firefox', 'error loading dynamically imported module: http://localhost:3000/static/spa/assets/A-1.js'],
    ['Safari', 'Importing a module script failed.'],
    ['Vite (CSS)', 'Unable to preload CSS for /static/spa/assets/A-1.css'],
  ])('recognises %s wording', async (_engine, message) => {
    const { router, redirect } = setup(() => new TypeError(message));
    await router.push('/');
    await tap(router, '/verifactu');
    expect(redirect).toHaveBeenCalledWith('/verifactu');
  });

  it('offline: keeps the screen it is on and says so, with a Retry that opens it afresh (never silent)', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { router, redirect } = setup();
    await router.push('/');
    await tap(router, '/verifactu');
    expect(redirect).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe('/');
    expect(toast).toHaveBeenCalledOnce();
    const [message, color, duration, id, action] = toast.mock.calls[0];
    expect(message).toBe('Could not open that page. Check the connection and try again.');
    expect(color).toBe('danger');
    expect(duration).toBe(0);
    expect(id).toBe('view-load-failed');
    expect(action.text).toBe('Retry');
    // A retry inside the SPA cannot work (the browser keeps a failed module import failed for the life of the
    // document): Retry opens the screen in a fresh document.
    action.handler();
    expect(redirect).toHaveBeenCalledWith('/verifactu');
  });

  it('says it in the language of the page', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    document.documentElement.lang = 'es';
    const { router } = setup();
    await router.push('/');
    await tap(router, '/verifactu');
    const [message, , , , action] = toast.mock.calls[0];
    expect(message).toBe('No se ha podido abrir esa página. Comprueba la conexión e inténtalo de nuevo.');
    expect(action.text).toBe('Reintentar');
  });

  it('never opens an address outside this hub: it stays, says so, and Retry reloads where the person is', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, href: window.location.href, reload });
    const { router, redirect } = setup(lostChunk, [{ path: '/:any(.*)*', component: () => Promise.reject(lostChunk()) }]);
    await router.push('/');
    await tap(router, '//evil.example/steal');
    expect(redirect).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledOnce();
    toast.mock.calls[0][4].handler();
    expect(redirect).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledOnce();
  });

  it("a screen whose own code throws is not reloaded (a fresh document runs the same code): the error stays loud", async () => {
    const bug = new Error('VerifactuPage: cannot read properties of undefined');
    const { router, redirect } = setup(() => bug);
    await router.push('/');
    await tap(router, '/verifactu');
    expect(redirect).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(bug);
  });

  it('the first screen of the document is left as it was: no reload from here, and the error stays in the console', async () => {
    const { router, redirect } = setup();
    await router.push('/verifactu').catch(() => undefined);
    await flushPromises();
    expect(redirect).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('dynamically imported') }));
  });
});
