/* eslint-disable vue/one-component-per-file -- test probes: one tiny component per composable under test */
import { flushPromises, mount } from '@vue/test-utils';
import { createApp, defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';

import { createShellSession, SESSION_KEY, type SessionMe, type SessionStatus } from './session';
import { provideShellConfig, useChromeVisible, useShellConfig } from './shell-config';

const Probe = defineComponent({
  setup() {
    const config = useShellConfig();
    return () => h('p', config.homePath);
  },
});

describe('shell config', () => {
  it('defaults to home "/" when nothing provided it', () => {
    expect(mount(Probe).text()).toBe('/');
  });

  it('is provided app-wide by createShell', () => {
    const app = createApp(Probe);
    provideShellConfig({ homePath: '/demo/items' }, app);
    const el = document.createElement('div');
    app.mount(el);
    expect(el.textContent).toBe('/demo/items');
    app.unmount();
  });

  // createShell passes every option it has, set or not: an unset one keeps its default. The hub left
  // `homePath` unset and got `undefined`: its topbar's Back went nowhere and showed on Home.
  it('keeps the default of an option passed unset', () => {
    const app = createApp(Probe);
    provideShellConfig({ homePath: undefined, home: true }, app);
    const el = document.createElement('div');
    app.mount(el);
    expect(el.textContent).toBe('/');
    app.unmount();
  });
});

// FIX-SHELL-SPLIT-PANE (PLAN-MIGRATIONS §16): the hub paints the old hub's side menu (`sidebar`); the
// SaaS keeps the menu of its session, which is what leaving it unset means.
describe('shell config: sidebar', () => {
  const SIDEBAR = { groups: [[{ id: 'employees', labelKey: 'sidebar.employees', icon: 'ion:people-outline', to: '/employees' }]] };

  it("is unset when nothing says otherwise (the SaaS's shell, unchanged)", () => {
    expect(useShellConfigIn(createApp(Probe)).sidebar).toBeUndefined();
  });

  it('is provided app-wide when the project hands one (the hub)', () => {
    const app = createApp(Probe);
    provideShellConfig({ homePath: '/', sidebar: SIDEBAR }, app);
    expect(useShellConfigIn(app)).toEqual({ homePath: '/', sidebar: SIDEBAR });
  });
});

/** What `useShellConfig` answers inside `app`. */
function useShellConfigIn(app: ReturnType<typeof createApp>) {
  let config: ReturnType<typeof useShellConfig> | undefined;
  app.runWithContext(() => {
    config = useShellConfig();
  });
  return config as ReturnType<typeof useShellConfig>;
}

// The one gate of the authenticated chrome (hub#925), shared by the side menu (App.vue) and the
// topbar's apps and rail buttons (the hub's sidebar): a session REQUIRED by the route and PRESENT, and a
// screen that does not paint its own frame.
describe('shell config: useChromeVisible', () => {
  const ChromeProbe = defineComponent({
    setup() {
      const visible = useChromeVisible();
      return () => h('p', String(visible.value));
    },
  });

  async function probe(path: string, user: SessionMe['user'] | 'no-session' = { id: 'u1', label: 'Ana' }) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/demo/items', component: { template: '<div />' }, meta: { auth: true } },
        { path: '/login', component: { template: '<div />' } },
        { path: '/launch', component: { template: '<div />' }, meta: { auth: true, chrome: false } },
      ],
    });
    await router.push(path);
    const me = ref<SessionMe | undefined>({ user: user === 'no-session' ? null : user, permissions: [], menu: [], apps: [], language: 'en' });
    const provide = user === 'no-session' ? {} : { [SESSION_KEY as symbol]: createShellSession(me, ref<SessionStatus>('live')) };
    const wrapper = mount(ChromeProbe, { global: { plugins: [router], provide } });
    return { wrapper, router, me };
  }

  it('is on behind a session, on a screen that requires one', async () => {
    expect((await probe('/demo/items')).wrapper.text()).toBe('true');
  });

  it('is off without a person, on a screen that asks for none, or on one that paints its own frame', async () => {
    expect((await probe('/demo/items', null)).wrapper.text()).toBe('false');
    expect((await probe('/login')).wrapper.text()).toBe('false');
    expect((await probe('/launch')).wrapper.text()).toBe('false');
  });

  it('is off, and does not throw, where no session was provided', async () => {
    expect((await probe('/demo/items', 'no-session')).wrapper.text()).toBe('false');
  });

  it('follows the route and the session live', async () => {
    const { wrapper, router, me } = await probe('/demo/items');
    await router.push('/launch');
    await flushPromises();
    expect(wrapper.text()).toBe('false');
    await router.push('/demo/items');
    await flushPromises();
    expect(wrapper.text()).toBe('true');
    me.value = { ...me.value!, user: null };
    await flushPromises();
    expect(wrapper.text()).toBe('false');
  });
});
