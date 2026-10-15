import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const toast = vi.hoisted(() => vi.fn());
vi.mock('./toast', () => ({ toast }));

import { IonModalStub } from '../components/FormModal/__tests__/ionModalStub';
import { unnamedButtons, unnamedIcons } from '../testing/a11y';
import AppsLauncher from './AppsLauncher.vue';
import HubIcon from './HubIcon.vue';
import { createShellI18n } from './i18n';
import { createShellSession, SESSION_KEY, type SessionMe, type SessionStatus } from './session';

function me(overrides: Partial<SessionMe> = {}): SessionMe {
  return {
    user: { id: 'u1', label: 'Ana Pérez' },
    permissions: ['demo.view', 'sale.view', 'kitchen.view'],
    menu: [
      { id: 'demo', label: 'Demo', items: [{ path: '/demo/items', label: 'Items', icon: 'ion:flask-outline' }] },
      { id: 'sale', label: 'Sales and point of sale', items: [{ path: '/sale/tickets', label: 'Tickets', icon: 'mdi:cart' }] },
      { id: 'kitchen', label: 'Kitchen', items: [{ path: '/kitchen', label: 'Kitchen', icon: 'ion:restaurant-outline' }] },
    ],
    apps: [
      { label: 'demo', state: 'on' },
      { label: 'sale', state: 'on' },
      { label: 'kitchen', state: 'activating' },
    ],
    language: 'en',
    ...overrides,
  };
}

let router: Router;
/** The lazy page of `/sale/tickets`: a chunk that may fail to load (hub#2489). */
let ticketsChunk: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  ticketsChunk = vi.fn(async () => ({ template: '<div />' }));
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/demo/items', component: { template: '<div />' } },
      { path: '/sale/tickets', component: () => ticketsChunk() },
      { path: '/kitchen', component: { template: '<div />' } },
    ],
  });
  await router.push('/demo/items');
});

afterEach(() => {
  toast.mockReset();
  vi.restoreAllMocks();
});

function mountLauncher(data: SessionMe | null = me(), status: SessionStatus = 'live', locale = 'en') {
  const session = ref<SessionMe | undefined>(data ?? undefined);
  const wrapper = mount(AppsLauncher, {
    attachTo: document.body,
    global: {
      plugins: [router, createShellI18n({ locale })],
      provide: { [SESSION_KEY as symbol]: createShellSession(session, ref(status)) },
      stubs: { IonModal: IonModalStub },
    },
  });
  return { wrapper, session };
}

type Wrapper = ReturnType<typeof mountLauncher>['wrapper'];
const trigger = (wrapper: Wrapper) => wrapper.get('[data-testid="topbar-apps"]');
const sheet = (wrapper: Wrapper) => wrapper.get('[data-stub="ion-modal"]');
const tiles = (wrapper: Wrapper) => wrapper.findAll('[data-testid="apps-launcher-app"]');

async function open(wrapper: Wrapper) {
  await trigger(wrapper).trigger('click');
  await flushPromises();
}

describe('AppsLauncher (the topbar door to the apps: «My apps» sheet, nav launcher)', () => {
  it('is a named button with the apps grid icon, that says it opens a dialog', () => {
    const { wrapper } = mountLauncher();
    const button = trigger(wrapper);
    expect(button.attributes('aria-label')).toBe('My apps');
    expect(button.attributes('aria-haspopup')).toBe('dialog');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(button.getComponent(HubIcon).props('name')).toBe('ion:apps-outline');
    expect(unnamedButtons(wrapper.element)).toEqual([]);
    expect(unnamedIcons(wrapper.element)).toEqual([]);
    expect(mountLauncher(me(), 'live', 'es').wrapper.get('[data-testid="topbar-apps"]').attributes('aria-label')).toBe('Mis apps');
    wrapper.unmount();
  });

  it('opens a sheet titled «My apps» with one tile per app, its icon and its name', async () => {
    const { wrapper } = mountLauncher();
    expect(tiles(wrapper)).toHaveLength(0);
    await open(wrapper);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true');
    expect(sheet(wrapper).get('ion-title').text()).toBe('My apps');
    expect(tiles(wrapper).map((tile) => tile.get('.apps-launcher-name').text())).toEqual([
      'Demo',
      'Sales and point of sale',
      'Kitchen',
    ]);
    expect(tiles(wrapper).map((tile) => tile.getComponent(HubIcon).props('name'))).toEqual([
      'ion:flask-outline',
      'mdi:cart',
      'ion:restaurant-outline',
    ]);
    wrapper.unmount();
  });

  it('is a sheet that sizes to its tiles and can be swiped away', async () => {
    const { wrapper } = mountLauncher();
    await open(wrapper);
    expect(sheet(wrapper).classes()).toContain('apps-launcher-sheet');
    expect(wrapper.findComponent(IonModalStub).attributes('data-testid')).toBe('apps-launcher');
    wrapper.unmount();
  });

  // hub#1106 / outfitkit#104: a long name is cut on the tile; the full one is still there to read.
  it('every tile carries the full name of its app, to the eye (title) and to the ear', async () => {
    const { wrapper } = mountLauncher();
    await open(wrapper);
    const sale = tiles(wrapper)[1];
    expect(sale.attributes('title')).toBe('Sales and point of sale');
    expect(sale.attributes('aria-label')).toBe('Sales and point of sale');
    expect(unnamedButtons(wrapper.element)).toEqual([]);
    wrapper.unmount();
  });

  it('a tile opens its app and closes the sheet', async () => {
    const { wrapper } = mountLauncher();
    await open(wrapper);
    await tiles(wrapper)[1].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/sale/tickets');
    expect(tiles(wrapper)).toHaveLength(0);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false');
    wrapper.unmount();
  });

  it('an app that is not on yet says so and opens nothing', async () => {
    const { wrapper } = mountLauncher();
    await open(wrapper);
    const kitchen = tiles(wrapper)[2];
    expect(kitchen.attributes('disabled')).toBeDefined();
    expect(kitchen.get('.apps-launcher-state').text()).toBe('Activating…');
    expect(kitchen.attributes('aria-label')).toBe('Kitchen, Activating…');
    await kitchen.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/demo/items');
    wrapper.unmount();
  });

  it('the close button and Ionic dismissing it (swipe, backdrop) close the sheet', async () => {
    const { wrapper } = mountLauncher();
    await open(wrapper);
    await wrapper.get('[data-testid="apps-launcher-close"]').trigger('click');
    await flushPromises();
    expect(tiles(wrapper)).toHaveLength(0);

    await open(wrapper);
    wrapper.findComponent(IonModalStub).vm.dismiss('backdrop');
    await flushPromises();
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false');
    wrapper.unmount();
  });

  it('without apps, an empty state instead of an empty grid', async () => {
    const { wrapper } = mountLauncher(me({ apps: [] }));
    await open(wrapper);
    expect(tiles(wrapper)).toHaveLength(0);
    expect(sheet(wrapper).get('[data-testid="apps-launcher-empty"]').text()).toContain('No apps yet');
    wrapper.unmount();
  });

  it('while the session is on its way, says it is loading; if it never comes, says so', async () => {
    let { wrapper } = mountLauncher(null, 'loading');
    await open(wrapper);
    expect(sheet(wrapper).find('[data-testid="apps-launcher-loading"]').exists()).toBe(true);
    wrapper.unmount();

    ({ wrapper } = mountLauncher(null, 'error'));
    await open(wrapper);
    expect(sheet(wrapper).get('[data-testid="apps-launcher-error"]').text()).toContain('Could not load your apps');
    wrapper.unmount();
  });

  it('follows the live session: an app turned on appears without reloading', async () => {
    const { wrapper, session } = mountLauncher(me({ apps: [{ label: 'demo', state: 'on' }] }));
    await open(wrapper);
    expect(tiles(wrapper)).toHaveLength(1);
    session.value = me();
    await flushPromises();
    expect(tiles(wrapper)).toHaveLength(3);
    wrapper.unmount();
  });
});

// hub#2489 / hub#2325: with a flaky network, tapping an app opened nothing and said nothing (its page
// is a lazy chunk; the failed import left the screen where it was).
describe('AppsLauncher: an app whose page fails to load (hub#2489)', () => {
  it('tries once more on its own, and opens the app when the network comes back', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    ticketsChunk.mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'));
    const { wrapper } = mountLauncher();
    await open(wrapper);
    await tiles(wrapper)[1].trigger('click');
    await flushPromises();
    expect(ticketsChunk).toHaveBeenCalledTimes(2);
    expect(router.currentRoute.value.path).toBe('/sale/tickets');
    expect(toast).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('never stays silent: when it still fails, an error toast says which app, with a Retry that opens it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    ticketsChunk.mockRejectedValue(new TypeError('Failed to fetch dynamically imported module'));
    const { wrapper } = mountLauncher();
    await open(wrapper);
    await tiles(wrapper)[1].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/demo/items');
    expect(error).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledOnce();
    const [message, color, duration, id, action] = toast.mock.calls[0];
    expect(message).toBe('Could not open Sales and point of sale. Check the connection and try again.');
    expect(color).toBe('danger');
    expect(duration).toBe(0);
    expect(id).toBe('apps-launcher-open');
    expect(action.text).toBe('Retry');

    ticketsChunk.mockResolvedValue({ template: '<div />' });
    action.handler();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/sale/tickets');
    wrapper.unmount();
  });
});
