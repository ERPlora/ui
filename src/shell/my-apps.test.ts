import { mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import { type MyApp, useMyApps } from './my-apps';
import { createShellSession, SESSION_KEY, type SessionMe, type SessionStatus } from './session';
import { applySurface } from './surface';

function me(overrides: Partial<SessionMe> = {}): SessionMe {
  return {
    user: { id: 'u1', label: 'Ana Pérez' },
    permissions: ['demo.view', 'sale.view'],
    menu: [
      {
        id: 'demo',
        label: 'Demo',
        items: [
          { path: '/demo/items', label: 'Items', icon: 'flask-outline' },
          { path: '/demo/stats', label: 'Stats', icon: 'ion:speedometer-outline' },
        ],
      },
      {
        id: 'sale',
        label: 'Sales',
        items: [
          { path: '/sale/store', label: 'Store', icon: 'ion:storefront-outline', webOnly: true },
          { path: '/sale/tickets', label: 'Tickets', icon: 'mdi:cart' },
        ],
      },
      { id: 'kitchen', label: 'Kitchen', items: [{ path: '/kitchen', label: 'Kitchen', icon: 'ion:restaurant-outline' }] },
    ],
    apps: [
      { label: 'demo', state: 'on' },
      { label: 'sale', state: 'on' },
      { label: 'kitchen', state: 'activating' },
      { label: 'invisible', state: 'on' },
    ],
    language: 'en',
    ...overrides,
  };
}

/** `null`: no `base.session.me` yet. */
function myApps(data: SessionMe | null = me()) {
  const session = ref<SessionMe | undefined>(data ?? undefined);
  let apps: { value: MyApp[] } = { value: [] };
  mount(
    defineComponent({
      setup() {
        apps = useMyApps();
        return () => h('div');
      },
    }),
    { global: { provide: { [SESSION_KEY as symbol]: createShellSession(session, ref<SessionStatus>('live')) } } },
  );
  return { apps, session };
}

describe('useMyApps (the apps of this hub: Home grid and «My apps» sheet)', () => {
  afterEach(() => applySurface('web'));

  it('one entry per app of base.session.me with a menu section: its name, and the icon and path of its first entry', () => {
    expect(myApps().apps.value.slice(0, 2)).toEqual([
      { id: 'demo', name: 'Demo', icon: 'ion:flask-outline', state: 'on', path: '/demo/items' },
      { id: 'sale', name: 'Sales', icon: 'ion:storefront-outline', state: 'on', path: '/sale/store' },
    ]);
  });

  it('an app that is not on yet keeps its state and has no path', () => {
    expect(myApps().apps.value.find((app) => app.id === 'kitchen')).toEqual({
      id: 'kitchen',
      name: 'Kitchen',
      icon: 'ion:restaurant-outline',
      state: 'activating',
      path: undefined,
    });
  });

  it('skips an app with nothing to open (no menu section), and is empty without a session', () => {
    expect(myApps().apps.value.map((app) => app.id)).toEqual(['demo', 'sale', 'kitchen']);
    expect(myApps(null).apps.value).toEqual([]);
  });

  it('on an app surface, an app opens its first entry that is not web-only', () => {
    applySurface('mobile');
    expect(myApps().apps.value.find((app) => app.id === 'sale')?.path).toBe('/sale/tickets');
  });

  it('follows the live session', async () => {
    const { apps, session } = myApps();
    session.value = me({ apps: [{ label: 'demo', state: 'on' }] });
    expect(apps.value.map((app) => app.id)).toEqual(['demo']);
  });
});
