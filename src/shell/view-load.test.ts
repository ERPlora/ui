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

/** A session with one app, VeriFactu, whose screens live under `/verifactu`. */
function withVerifactu(): SessionMe {
  return {
    ...me(),
    menu: [{ id: 'verifactu', label: 'VeriFactu', items: [{ path: '/verifactu', label: 'Records', icon: 'ion:list-outline' }] }],
    apps: [{ label: 'verifactu', state: 'on' }],
  };
}

/** The check of the file: the server answers (a 404 after a deploy), or the network does not. */
const answers = (status = 404) => vi.fn(async () => ({ status }) as Response);
const noAnswer = () => vi.fn(async (): Promise<Response> => Promise.reject(new TypeError('Failed to fetch')));

function setup(failure: () => unknown = lostChunk, extra: RouteRecordRaw[] = [], session: SessionMe = me()) {
  const redirect = vi.fn();
  const router = createShellRouter(
    [
      { path: '/', component: Page, meta: { auth: true } },
      { path: '/verifactu', component: () => Promise.reject(failure()), meta: { auth: true } },
      { path: '/sale/charge', component: () => Promise.reject(failure()), meta: { auth: true } },
      ...extra,
    ],
    {
      session: createShellSession(ref<SessionMe | undefined>(session), ref<SessionStatus>('live')),
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
  vi.stubGlobal('fetch', answers());
});

afterEach(() => {
  toast.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
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

  it('asks the server for the very file that failed, uncached, before leaving the screen', async () => {
    const check = answers();
    vi.stubGlobal('fetch', check);
    const { router } = setup();
    await router.push('/');
    await tap(router, '/verifactu');
    expect(check).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledWith('http://localhost:3000/static/spa/assets/VerifactuPage-0ld.js', {
      method: 'HEAD',
      cache: 'no-store',
    });
  });

  it('Safari names no file: it asks for the address of the screen instead', async () => {
    const check = answers(200);
    vi.stubGlobal('fetch', check);
    const { router, redirect } = setup(() => new TypeError('Importing a module script failed.'));
    await router.push('/');
    await tap(router, '/verifactu');
    expect(check).toHaveBeenCalledWith('/verifactu', { method: 'HEAD', cache: 'no-store' });
    expect(redirect).toHaveBeenCalledWith('/verifactu');
  });

  // hub#2489: a flaky network leaves the browser «online». A fresh document there would be the browser's error page,
  // or a blank first screen, with no way back to the till.
  it('a flaky network the browser still calls online: keeps the screen and says so, never a fresh document', async () => {
    vi.stubGlobal('fetch', noAnswer());
    const { router, redirect } = setup();
    await router.push('/');
    await tap(router, '/verifactu');
    expect(redirect).not.toHaveBeenCalled();
    expect(router.currentRoute.value.path).toBe('/');
    expect(toast).toHaveBeenCalledOnce();
    const [message, , duration, id, action] = toast.mock.calls[0];
    expect(message).toBe('Could not open that page. Check the connection and try again.');
    expect(duration).toBe(0);
    expect(id).toBe('view-load-failed');
    expect(action.text).toBe('Retry');
  });

  it('a check that never answers: after 5 s it stays and says so, never waits for ever', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    const { router, redirect } = setup();
    await router.push('/');
    await tap(router, '/verifactu');
    expect(toast).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4999);
    expect(toast).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(redirect).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledOnce();
  });

  it('Retry asks again: still no answer, it stays and says so again; with one, the screen opens afresh', async () => {
    const check = noAnswer();
    vi.stubGlobal('fetch', check);
    const { router, redirect } = setup();
    await router.push('/');
    await tap(router, '/verifactu');
    toast.mock.calls[0][4].handler();
    await flushPromises();
    expect(redirect).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledTimes(2);
    expect(toast.mock.calls[1][3]).toBe('view-load-failed');

    check.mockResolvedValue({ status: 200 } as Response);
    toast.mock.calls[1][4].handler();
    await flushPromises();
    expect(redirect).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith('/verifactu');
  });

  it('names the app when the screen is one of its apps, as «My apps» did (hub#2489)', async () => {
    vi.stubGlobal('fetch', noAnswer());
    const { router } = setup(lostChunk, [], withVerifactu());
    await router.push('/');
    await tap(router, '/verifactu');
    expect(toast.mock.calls[0][0]).toBe('Could not open VeriFactu. Check the connection and try again.');
    toast.mockReset();
    document.documentElement.lang = 'es';
    await tap(router, '/sale/charge');
    expect(toast.mock.calls[0][0]).toBe('No se ha podido abrir esa página. Comprueba la conexión e inténtalo de nuevo.');
  });

  it("never names a section of the menu that is not an app (the hub's own screens)", async () => {
    vi.stubGlobal('fetch', noAnswer());
    const session = withVerifactu();
    session.menu.push({ id: 'base', label: 'My business', items: [{ path: '/settings', label: 'Settings', icon: 'ion:cog' }] });
    const { router } = setup(lostChunk, [{ path: '/settings', component: () => Promise.reject(lostChunk()) }], session);
    await router.push('/');
    await tap(router, '/settings');
    expect(toast.mock.calls[0][0]).toBe('Could not open that page. Check the connection and try again.');
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

  it('offline: keeps the screen it is on and says so, with a Retry that opens it afresh once back online (never silent)', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
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
    // document): back online, Retry opens the screen in a fresh document.
    online.mockReturnValue(true);
    action.handler();
    await flushPromises();
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
