import { flushPromises, mount } from '@vue/test-utils';
import { ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, describe, expect, it } from 'vitest';

import EmptyState from '../components/EmptyState/EmptyState.vue';
import AppPage from './AppPage.vue';
import HomePage from './HomePage.vue';
import HubIcon from './HubIcon.vue';
import { createShellI18n } from './i18n';
import { createShellSession, SESSION_KEY, type SessionMe, type SessionStatus } from './session';
import { applySurface } from './surface';

type El = HTMLElement & Record<string, unknown>;

function me(overrides: Partial<SessionMe> = {}): SessionMe {
  return {
    user: { id: 'u1', label: 'Ana Pérez' },
    permissions: ['demo.view', 'sale.view'],
    menu: [
      {
        id: 'demo',
        label: 'Demo',
        items: [
          { path: '/demo/items', label: 'Items', icon: 'ion:flask-outline' },
          { path: '/demo/stats', label: 'Stats', icon: 'ion:speedometer-outline' },
        ],
      },
      { id: 'sale', label: 'Sales', items: [{ path: '/sale/tickets', label: 'Tickets', icon: 'mdi:cart' }] },
    ],
    apps: [
      { label: 'demo', state: 'on' },
      { label: 'sale', state: 'on' },
    ],
    language: 'en',
    ...overrides,
  };
}

function mountHome(data: SessionMe = me(), locale = 'en') {
  const session = ref<SessionMe | undefined>(data);
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: HomePage }] });
  const wrapper = mount(HomePage, {
    global: {
      plugins: [router, createShellI18n({ locale })],
      provide: { [SESSION_KEY as symbol]: createShellSession(session, ref<SessionStatus>('live')) },
    },
  });
  return { wrapper, session };
}

const cards = (wrapper: ReturnType<typeof mountHome>['wrapper']) => wrapper.findAll('[data-testid="home-app"]');

describe('HomePage (Odoo-style home: the apps of this hub as a grid)', () => {
  afterEach(() => applySurface('web'));

  it('is painted inside the shell layout, titled Home in the user language', () => {
    expect(mountHome().wrapper.getComponent(AppPage).props('title')).toBe('Home');
    expect(mountHome(me(), 'es').wrapper.getComponent(AppPage).props('title')).toBe('Inicio');
  });

  it('shows one card per app of base.session.me, named and iconed by its menu section', () => {
    const { wrapper } = mountHome();
    const found = cards(wrapper);
    expect(found.map((card) => card.get('.home-app-name').text())).toEqual(['Demo', 'Sales']);
    expect(found.map((card) => card.getComponent(HubIcon).props('name'))).toEqual(['ion:flask-outline', 'mdi:cart']);
  });

  it("each card opens the app's first route, as a root navigation (like the menu)", () => {
    const found = cards(mountHome().wrapper);
    expect(found.map((card) => card.attributes('routerlink'))).toEqual(['/demo/items', '/sale/tickets']);
    for (const card of found) {
      expect((card.element as El).button).toBe(true);
      expect((card.element as El).routerDirection).toBe('root');
    }
  });

  it('an app that is not on yet says so, and opens nothing until it is', () => {
    const { wrapper } = mountHome(
      me({
        apps: [
          { label: 'demo', state: 'activating' },
          { label: 'sale', state: 'off' },
        ],
      }),
    );
    const [demo, sale] = cards(wrapper);
    expect(demo.get('ion-badge').text()).toBe('Activating…');
    expect(sale.get('ion-badge').text()).toBe('Off');
    for (const card of [demo, sale]) {
      expect(card.attributes('routerlink')).toBeUndefined();
      expect((card.element as El).button).toBe(false);
    }
    expect(cards(mountHome().wrapper)[0].find('ion-badge').exists()).toBe(false);
  });

  it('shows only the apps that have something to open (a menu section), as the menu does', () => {
    const { wrapper } = mountHome(me({ apps: [{ label: 'demo', state: 'on' }, { label: 'printing', state: 'on' }] }));
    expect(cards(wrapper).map((card) => card.get('.home-app-name').text())).toEqual(['Demo']);
  });

  it('without apps, a friendly empty state instead of an empty grid', () => {
    const { wrapper } = mountHome(me({ apps: [], menu: [] }));
    expect(cards(wrapper)).toHaveLength(0);
    const empty = wrapper.getComponent(EmptyState);
    expect(empty.attributes('data-testid')).toBe('home-empty');
    expect(empty.props('heading')).toBe('No apps yet');
    expect(empty.props('icon')).toBe('apps-outline');
    expect(empty.props('message')).toBeTruthy();
    const es = mountHome(me({ apps: [], menu: [] }), 'es').wrapper.getComponent(EmptyState);
    expect(es.props('heading')).toBe('Aún no hay aplicaciones');
  });

  it('follows the live session: an app turned on appears without reloading', async () => {
    const { wrapper, session } = mountHome(me({ apps: [{ label: 'demo', state: 'on' }] }));
    expect(cards(wrapper)).toHaveLength(1);
    session.value = me();
    await flushPromises();
    expect(cards(wrapper)).toHaveLength(2);
  });

  // The home never offers what the menu does not: on the app surfaces the menu drops the web-only
  // entries (App.vue, surface.ts), so a card skips them too, and an app left with none has no card.
  it('on an app surface, skips the web-only entries, as the menu does', () => {
    const data = me({
      menu: [
        {
          id: 'demo',
          label: 'Demo',
          items: [
            { path: '/demo/plans', label: 'Plans', icon: 'ion:cart-outline', webOnly: true },
            { path: '/demo/items', label: 'Items', icon: 'ion:flask-outline' },
          ],
        },
        { id: 'sale', label: 'Sales', items: [{ path: '/sale/store', label: 'Store', icon: 'mdi:cart', webOnly: true }] },
      ],
    });
    expect(cards(mountHome(data).wrapper).map((card) => card.attributes('routerlink'))).toEqual(['/demo/plans', '/sale/store']);
    applySurface('desktop');
    const found = cards(mountHome(data).wrapper);
    expect(found.map((card) => card.get('.home-app-name').text())).toEqual(['Demo']);
    expect(found.map((card) => card.attributes('routerlink'))).toEqual(['/demo/items']);
  });
});
