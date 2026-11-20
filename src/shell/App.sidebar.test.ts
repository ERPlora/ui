import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { h, ref } from 'vue';

import HubIcon from './HubIcon.vue';
import { useSession } from './session';
import type { ShellConfig } from './shell-config';
import { railCollapsed, type ShellSidebar, type ShellSidebarItem } from './sidebar';
import SidebarInstallQr from './SidebarInstallQr.vue';
import { type El, me, mountApp, openApp, router, session } from './__tests__/app-shell';

beforeEach(openApp);

afterEach(() => {
  railCollapsed.value = false;
});

// The hub's shell: the side menu pinned from lg (a drawer below), with the platform's entries and no
// module in it (the modules open from «My apps» and Home), the QR in its footer and a rail the topbar
// folds it to.
describe("App: the hub's sidebar (createShell({ sidebar }))", () => {
  const entry = (id: string, to: string, icon: string): ShellSidebarItem => ({ id, labelKey: `sidebar.${id}`, icon, to });
  const SIDEBAR: ShellSidebar = {
    groups: [
      [entry('employees', '/employees', 'ion:people-outline'), entry('files', '/files', 'ion:folder-outline')],
      [entry('billing', '/billing', 'ion:card-outline'), entry('settings', '/settings', 'ion:settings-outline')],
    ],
  };
  const HUB: ShellConfig = { homePath: '/', home: true, sidebar: SIDEBAR };

  beforeEach(() => {
    // Employees and Settings have their screen; Files and My plan do not (yet): they must not show.
    router.addRoute({ path: '/employees/:id?', component: { template: '<div />' }, meta: { auth: true } });
    router.addRoute({ path: '/settings', component: { template: '<div />' }, meta: { auth: true } });
  });

  const lists = (wrapper: ReturnType<typeof mountApp>) => wrapper.findAll('ion-menu ion-content ion-list.nav-list');
  const itemsOf = (list: ReturnType<typeof lists>[number]) => list.findAll('ion-menu-toggle > ion-item.nav-item');

  it('paints Home and the platform entries whose screen exists, in their groups; no module of the session', () => {
    const wrapper = mountApp(undefined, { config: HUB });
    expect(lists(wrapper).map((list) => itemsOf(list).map((i) => i.attributes('routerlink')))).toEqual([
      ['/', '/employees'],
      ['/settings'],
    ]);
    expect(wrapper.findAll('ion-item.nav-item').map((i) => i.attributes('data-testid'))).toEqual([
      'nav-home',
      'nav-employees',
      'nav-settings',
    ]);
    expect(wrapper.findAll('ion-item.nav-item').map((i) => i.getComponent(HubIcon).props('name'))).toEqual([
      'ion:home-outline',
      'ion:people-outline',
      'ion:settings-outline',
    ]);
    for (const item of wrapper.findAll('ion-item.nav-item')) {
      expect((item.element as El).routerDirection).toBe('root');
      expect((item.element as El).detail).toBe(false);
    }
  });

  it('speaks the language of the person', () => {
    const labels = (locale: string) =>
      mountApp(undefined, { config: HUB, locale })
        .findAll('ion-item.nav-item ion-label.nav-label')
        .map((label) => label.element.innerHTML.trim());
    expect(labels('en')).toEqual(['Home', 'Employees', 'Settings']);
    expect(labels('es')).toEqual(['Inicio', 'Empleados', 'Ajustes']);
  });

  // Without a name of its own, Ionic 8 names the menu's navigation landmark «menu» in every language:
  // a screen reader announced it in English to a person who reads Spanish.
  it('names the side menu in the language of the person, not with the «menu» Ionic puts', () => {
    const name = (locale: string) => mountApp(undefined, { config: HUB, locale }).get('ion-menu').attributes('aria-label');
    expect(name('en')).toBe('Main menu');
    expect(name('es')).toBe('Menú principal');
  });

  // The group headers are dividers without words: a line under the person and one between the groups.
  it('a divider opens each group: under the person, and between the two', () => {
    const groups = lists(mountApp(undefined, { config: HUB }));
    expect(groups.map((list) => list.findAll(':scope > ion-list-header.nav-section-label').map((h) => h.attributes('role')))).toEqual([
      ['separator'],
      ['separator'],
    ]);
    expect(groups.map((list) => list.element.firstElementChild?.tagName.toLowerCase())).toEqual(['ion-list-header', 'ion-list-header']);
  });

  // `visible` is a composable the shell runs once in its setup (so it may read the session or a live
  // query); the entry shows and goes with its value, live, and a group it leaves empty goes too.
  it('an entry with `visible` shows and goes with it, live; its composable runs once and reads the session', async () => {
    const shown = ref(false);
    let runs = 0;
    const sidebar: ShellSidebar = {
      groups: [
        [
          entry('employees', '/employees', 'ion:people-outline'),
          {
            ...entry('docs', '/settings', 'ion:code-slash-outline'),
            visible: () => {
              runs += 1;
              return shown;
            },
          },
        ],
        [
          {
            ...entry('settings', '/settings', 'ion:settings-outline'),
            visible: () => {
              const people = useSession();
              return () => people.can('base.administer_hub');
            },
          },
        ],
      ],
    };
    const wrapper = mountApp(undefined, { config: { ...HUB, sidebar } });
    const ids = () => wrapper.findAll('ion-item.nav-item').map((i) => i.attributes('data-testid'));
    expect(ids()).toEqual(['nav-home', 'nav-employees']);
    expect(wrapper.findAll('.nav-section-label')).toHaveLength(1);
    shown.value = true;
    session.value = me({ permissions: ['base.administer_hub'] });
    await flushPromises();
    expect(ids()).toEqual(['nav-home', 'nav-employees', 'nav-docs', 'nav-settings']);
    shown.value = false;
    await flushPromises();
    expect(ids()).toEqual(['nav-home', 'nav-employees', 'nav-settings']);
    expect(runs).toBe(1);
  });

  it('Home without a group to share: alone, under its divider, and no divider left hanging', () => {
    const wrapper = mountApp(undefined, { config: { ...HUB, sidebar: { groups: [[entry('files', '/files', 'ion:folder-outline')], [entry('billing', '/billing', 'ion:card-outline')]] } } });
    expect(lists(wrapper).map((list) => itemsOf(list).map((i) => i.attributes('data-testid')))).toEqual([['nav-home']]);
    expect(wrapper.findAll('.nav-section-label')).toHaveLength(1);
  });

  it('marks the entry on screen, also on its sub-paths, and only that one', async () => {
    await router.push('/employees/7');
    const wrapper = mountApp(undefined, { config: HUB });
    const selected = wrapper.findAll('ion-item.nav-item').filter((i) => i.classes().includes('selected'));
    expect(selected.map((i) => [i.attributes('data-testid'), i.attributes('aria-current')])).toEqual([['nav-employees', 'page']]);

    await router.push('/');
    await flushPromises();
    const home = wrapper.findAll('ion-item.nav-item').filter((i) => i.classes().includes('selected'));
    expect(home.map((i) => i.attributes('data-testid'))).toEqual(['nav-home']);
  });

  // In the drawer, picking an entry closes it, so the screen it opens is not left covered.
  it('every entry closes the drawer when picked (ion-menu-toggle, auto-hide off)', () => {
    const toggles = mountApp(undefined, { config: HUB }).findAll('ion-menu ion-content ion-menu-toggle');
    expect(toggles.map((toggle) => [(toggle.element as El).autoHide, toggle.findAll('ion-item.nav-item').length])).toEqual([
      [false, 1],
      [false, 1],
      [false, 1],
    ]);
  });

  it('the footer: the QR «Open on your phone» above the brand', () => {
    const foot = mountApp(undefined, { config: HUB }).get('ion-menu ion-footer.sidebar-foot');
    expect(foot.findAll(':scope > *').map((child) => child.classes()[0])).toEqual(['sidebar-install-qr', 'sidebar-foot-brand']);
    expect(foot.findComponent(SidebarInstallQr).exists()).toBe(true);
  });

  // The project's piece of the footer (the hub's «Upgrade plan») goes under the QR and over the brand,
  // inside the menu, so only behind a session.
  const Plan = { name: 'ProjectPlan', render: () => h('a', { class: 'upgrade-plan' }, 'Upgrade plan') };

  it("the footer with the project's piece: QR, the piece, then the brand", () => {
    const foot = mountApp(undefined, { config: { ...HUB, chrome: { sidebarFooter: Plan } } }).get(
      'ion-menu ion-footer.sidebar-foot',
    );
    expect(foot.findAll(':scope > *').map((child) => child.classes()[0])).toEqual([
      'sidebar-install-qr',
      'sidebar-foot-chrome',
      'sidebar-foot-brand',
    ]);
    expect(foot.get('.sidebar-foot-chrome').findComponent(Plan).exists()).toBe(true);
  });

  it("no piece of the project in the footer when it gives none, nor without a person signed in", () => {
    expect(mountApp(undefined, { config: HUB }).find('.sidebar-foot-chrome').exists()).toBe(false);
    session.value = me({ user: null });
    expect(mountApp(undefined, { config: { ...HUB, chrome: { sidebarFooter: Plan } } }).findComponent(Plan).exists()).toBe(
      false,
    );
  });

  // The project's piece that paints nothing (the hub's device notices) is mounted once, next to
  // the pane, while a person is signed in — on every screen, its own frame included — and again for the next one.
  const Listener = { name: 'ProjectListener', render: () => h('i', { class: 'project-listener' }) };

  it("mounts the project's background piece once, beside the pane, on every screen of a signed-in person", async () => {
    const wrapper = mountApp(undefined, { config: { ...HUB, chrome: { background: Listener } } });
    expect(wrapper.findAllComponents(Listener)).toHaveLength(1);
    expect(wrapper.find('ion-split-pane .project-listener').exists()).toBe(false);

    await router.push('/launch');
    await flushPromises();

    expect(wrapper.findAllComponents(Listener)).toHaveLength(1);
  });

  // The piece's key follows the person, yet it is not the pane's: they are siblings, and Vue warns of a repeated key.
  it('no background piece without a person signed in, and a new one with a key of its own for the next person', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    session.value = me({ user: null });
    const wrapper = mountApp(undefined, { config: { ...HUB, chrome: { background: Listener } } });
    expect(wrapper.findComponent(Listener).exists()).toBe(false);

    session.value = me({ user: { id: 'u2', label: 'Luis Gil' } });
    await flushPromises();
    const first = wrapper.findComponent(Listener);
    expect(first.exists()).toBe(true);
    session.value = me({ user: { id: 'u3', label: 'Marta Ruiz' } });
    await flushPromises();

    const repeatedKeys = warn.mock.calls.map((call) => String(call[0])).filter((text) => text.includes('Duplicate keys'));
    warn.mockRestore();
    expect(repeatedKeys).toEqual([]);
    expect(first.exists()).toBe(false);
    expect(wrapper.findAllComponents(Listener)).toHaveLength(1);
  });

  // Each app's background piece (the printing app's print host) is mounted the same way, next to the project's.
  const AppPiece = { name: 'AppBackground', render: () => h('b', { class: 'app-background' }) };

  it("mounts each app's background piece beside the pane, on every screen of a signed-in person, and anew for the next", async () => {
    session.value = me({ user: null });
    const wrapper = mountApp(undefined, {
      config: { ...HUB, chrome: { background: Listener }, backgrounds: [AppPiece, Listener] },
    });
    expect(wrapper.findComponent(AppPiece).exists()).toBe(false);

    session.value = me({ user: { id: 'u2', label: 'Luis Gil' } });
    await flushPromises();
    const first = wrapper.findComponent(AppPiece);
    expect(first.exists()).toBe(true);
    expect(wrapper.find('ion-split-pane .app-background').exists()).toBe(false);
    expect(wrapper.findAllComponents(Listener)).toHaveLength(2);
    await router.push('/launch');
    await flushPromises();
    expect(wrapper.findAllComponents(AppPiece)).toHaveLength(1);

    session.value = me({ user: { id: 'u3', label: 'Marta Ruiz' } });
    await flushPromises();
    expect(first.exists()).toBe(false);
    expect(wrapper.findAllComponents(AppPiece)).toHaveLength(1);
  });

  it('folds to a rail while the topbar says so, and opens again', async () => {
    const wrapper = mountApp(undefined, { config: HUB });
    expect(wrapper.get('ion-split-pane').classes()).not.toContain('rail');
    railCollapsed.value = true;
    await flushPromises();
    expect(wrapper.get('ion-split-pane').classes()).toContain('rail');
    railCollapsed.value = false;
    await flushPromises();
    expect(wrapper.get('ion-split-pane').classes()).not.toContain('rail');
  });

  it('still no menu without a user, nor on a screen that does not require a session', async () => {
    session.value = me({ user: null });
    expect(mountApp(undefined, { config: HUB }).find('ion-menu').exists()).toBe(false);
    session.value = me();
    await router.push('/login');
    expect(mountApp(undefined, { config: HUB }).find('ion-menu').exists()).toBe(false);
  });

  it('the SaaS (no sidebar) keeps the menu of its session: no QR, and never a rail', async () => {
    railCollapsed.value = true;
    const wrapper = mountApp(undefined, { config: { homePath: '/' } });
    await flushPromises();
    expect(wrapper.find('.sidebar-install-qr').exists()).toBe(false);
    expect(wrapper.get('ion-split-pane').classes()).not.toContain('rail');
    expect(wrapper.findAll('ion-item.nav-item').map((i) => i.attributes('routerlink'))).toEqual(['/demo/items', '/demo/stats', '/settings']);
  });
});
