/* eslint-disable vue/one-component-per-file -- small inline fixture components */
import { mount } from '@vue/test-utils';
import { createApp, defineComponent, h, nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import {
  createShellSession,
  provideSession,
  sessionReady,
  type SessionMe,
  type SessionStatus,
  useSession,
} from './session';

function me(overrides: Partial<SessionMe> = {}): SessionMe {
  return {
    user: { id: 'u1', label: 'Ana Pérez' },
    permissions: ['demo.view'],
    menu: [
      {
        id: 'general',
        label: 'General',
        items: [{ path: '/demo/items', label: 'Items', icon: 'ion:cube-outline' }],
      },
    ],
    apps: [{ label: 'Demo', state: 'on' }],
    language: 'es',
    ...overrides,
  };
}

describe('createShellSession', () => {
  it('derives user and menu from base.session.me', () => {
    const session = createShellSession(ref(me()), ref<SessionStatus>('live'));
    expect(session.user.value).toEqual({ id: 'u1', label: 'Ana Pérez' });
    expect(session.menu.value[0].items[0].path).toBe('/demo/items');
  });

  it('has no user and an empty menu while base.session.me has not arrived', () => {
    const session = createShellSession(ref<SessionMe | undefined>(undefined), ref<SessionStatus>('loading'));
    expect(session.user.value).toBeNull();
    expect(session.menu.value).toEqual([]);
  });

  it('follows the refs it was given (live updates)', () => {
    const data = ref<SessionMe | undefined>(me());
    const session = createShellSession(data, ref<SessionStatus>('live'));
    data.value = me({ user: { id: 'u2', label: 'Luis' } });
    expect(session.user.value?.id).toBe('u2');
  });

  it('can(): exact permission or the superuser wildcard', () => {
    const data = ref<SessionMe | undefined>(me());
    const session = createShellSession(data, ref<SessionStatus>('live'));
    expect(session.can('demo.view')).toBe(true);
    expect(session.can('demo.manage')).toBe(false);
    data.value = me({ permissions: ['*'] });
    expect(session.can('demo.manage')).toBe(true);
    data.value = undefined;
    expect(session.can('demo.view')).toBe(false);
  });
});

describe('provideSession / useSession', () => {
  const Child = defineComponent({
    setup() {
      const session = useSession();
      return () => h('p', session.user.value?.label ?? 'nobody');
    },
  });

  it('provides to descendants from a component setup', () => {
    const Parent = defineComponent({
      setup() {
        provideSession(ref(me()), ref<SessionStatus>('live'));
        return () => h(Child);
      },
    });
    expect(mount(Parent).text()).toBe('Ana Pérez');
  });

  it('provides app-wide when given the app (createShell, outside any component)', () => {
    const app = createApp(Child);
    const session = provideSession(ref(me()), ref<SessionStatus>('live'), { app });
    const el = document.createElement('div');
    app.mount(el);
    expect(el.textContent).toBe('Ana Pérez');
    expect(session.status.value).toBe('live');
    app.unmount();
  });

  it('throws a clear error when nothing provided the session', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => mount(Child)).toThrow(/useSession\(\).*provideSession/);
    vi.restoreAllMocks();
  });
});

describe('sessionReady', () => {
  it('resolves at once when base.session.me is already there (embedded in the HTML)', async () => {
    await expect(sessionReady(createShellSession(ref(me()), ref<SessionStatus>('loading')))).resolves.toBeUndefined();
  });

  it('waits while loading and resolves when the stream answers or fails', async () => {
    const data = ref<SessionMe | undefined>(undefined);
    const status = ref<SessionStatus>('loading');
    const session = createShellSession(data, status);
    let done = false;
    void sessionReady(session).then(() => (done = true));
    await nextTick();
    expect(done).toBe(false);
    status.value = 'error';
    await nextTick();
    await Promise.resolve();
    expect(done).toBe(true);
  });
});
