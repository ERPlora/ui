import { flushPromises, mount } from '@vue/test-utils';
import { createApp, defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';

import { createShellSession, SESSION_KEY, type SessionMe, type SessionStatus } from './session';
import { provideShellConfig, shellNav, useChromeVisible, useShellConfig } from './shell-config';

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
});

// FIX-SHELL-NAV (PLAN-MIGRATIONS §13): the hub's shell has no side menu; Back, the apps and the user
// live in the topbar. The SaaS keeps its menu: `menu` is what an unset `nav` means.
describe('shell config: nav', () => {
  const NavProbe = defineComponent({
    setup() {
      const config = useShellConfig();
      return () => h('p', shellNav(config));
    },
  });

  it("is the side menu when nothing says otherwise (the SaaS's shell, unchanged)", () => {
    expect(mount(NavProbe).text()).toBe('menu');
    expect(shellNav({ homePath: '/' })).toBe('menu');
  });

  it('is the launcher when the project asks for it (the hub)', () => {
    const app = createApp(NavProbe);
    provideShellConfig({ homePath: '/', nav: 'launcher' }, app);
    const el = document.createElement('div');
    app.mount(el);
    expect(el.textContent).toBe('launcher');
    app.unmount();
  });
});

// The one gate of the authenticated chrome (hub#925), shared by the side menu (App.vue) and the
// topbar's apps and user buttons (launcher): a session REQUIRED by the route and PRESENT, and a
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
