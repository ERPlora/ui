import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { IonModalStub } from '../components/FormModal/__tests__/ionModalStub';
import { unnamedButtons } from '../testing/a11y';
import { IonPopoverStub } from './__tests__/ionPopoverStub';
import AppTopbar from './AppTopbar.vue';
import { createShellI18n } from './i18n';
import { createShellSession, SESSION_KEY, type SessionMe } from './session';
import { SHELL_CONFIG_KEY, type ShellConfig } from './shell-config';
import { useTopbarMenu } from './topbar-menu';

// On a phone the end of the bar holds two buttons, the bell always one of them: «My apps», the project's piece (the
// assistant) and the view's actions go into one «⋮» when they do not fit beside it. The title keeps its centre.
/** A cashier of a hub with its point of sale on: one app in «My apps». */
const CASHIER: SessionMe = {
  user: { id: 'u2', label: 'Leo Martín' },
  permissions: [],
  menu: [{ id: 'sale', label: 'Sales', items: [{ path: '/sale', label: 'Sales', icon: 'ion:cart-outline' }] }],
  apps: [{ label: 'sale', state: 'on' }],
  language: 'en',
};

/** The project's piece, like the assistant: its sparkles in the bar, a labelled row in the menu. */
const Piece = defineComponent({
  setup() {
    const menu = useTopbarMenu();
    return () => h('button', { 'data-testid': 'project-topbar', 'aria-label': 'Assistant' }, menu ? 'Assistant' : '');
  },
});

const bell = () => ({ notices: ref([]), failed: ref(false) });
const HUB: Partial<ShellConfig> = { home: true, sidebar: { groups: [] }, chrome: { topbar: Piece }, actionNotices: bell };
const SAAS: Partial<ShellConfig> = { chrome: { topbar: Piece }, actionNotices: bell };
const OF_THE_BAR = ['topbar-more', 'topbar-apps', 'project-topbar', 'action-bell', 'edit', 'done'];

let router: Router;

beforeEach(async () => {
  router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' }, meta: { auth: true } }] });
  await router.push('/');
});

afterEach(() => vi.restoreAllMocks());

function mountBar(phone: boolean, config: Partial<ShellConfig>, { actions = [] as string[], locale = 'en' } = {}) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({
    matches: phone,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  } as unknown as MediaQueryList);
  return mount(AppTopbar, {
    props: { title: 'Home' },
    slots: { actions: () => actions.map((name) => h('button', { 'data-testid': name }, name)) },
    global: {
      plugins: [router, createShellI18n({ locale })],
      provide: {
        [SHELL_CONFIG_KEY as symbol]: { homePath: '/', ...config },
        [SESSION_KEY as symbol]: createShellSession(ref(CASHIER), ref('live')),
      },
      stubs: { IonModal: IonModalStub, IonPopover: IonPopoverStub },
    },
  });
}

type Bar = ReturnType<typeof mountBar>;
/** The buttons at the end of the bar itself, in order (not those listed in «⋮»). */
const inBar = (bar: Bar) =>
  bar
    .get('ion-buttons[slot="end"]')
    .findAll(OF_THE_BAR.map((id) => `[data-testid="${id}"]`).join(', '))
    .filter((button) => !button.element.closest('[data-stub="ion-popover"]'))
    .map((button) => button.attributes('data-testid'));
const menu = (bar: Bar) => bar.find('[data-testid="topbar-more-menu"]');

async function openMore(bar: Bar) {
  await bar.get('[data-testid="topbar-more"]').trigger('click');
  return menu(bar);
}

describe('AppTopbar on a phone: two buttons at the end of the bar, the bell always one of them', () => {
  it('the hub: «My apps» and its piece go into «⋮», and the bell stays after it', () => {
    const bar = mountBar(true, HUB);
    expect(inBar(bar)).toEqual(['topbar-more', 'action-bell']);
    expect(unnamedButtons(bar.element)).toEqual([]);
  });

  it('«⋮» lists the view actions, «My apps» and the piece, each a row with its label', async () => {
    const bar = mountBar(true, HUB, { actions: ['edit'] });
    expect(inBar(bar)).toEqual(['topbar-more', 'action-bell']);
    const rows = await openMore(bar);
    expect(rows.findAll('[data-testid]').map((row) => row.attributes('data-testid'))).toEqual([
      'edit',
      'topbar-more-apps',
      'project-topbar',
    ]);
    expect(rows.get('[data-testid="topbar-more-apps"]').text()).toBe('My apps');
    expect(rows.get('[data-testid="project-topbar"]').text()).toBe('Assistant');
    const es = await openMore(mountBar(true, HUB, { locale: 'es' }));
    expect(es.get('[data-testid="topbar-more-apps"]').text()).toBe('Mis apps');
  });

  it('«My apps» in «⋮» opens the apps sheet once the menu has gone', async () => {
    const bar = mountBar(true, HUB);
    await (await openMore(bar)).get('[data-testid="topbar-more-apps"]').trigger('click');
    expect(menu(bar).exists()).toBe(false);
    expect(bar.find('[data-testid="apps-launcher-app"]').exists()).toBe(false);
    bar.getComponent(IonPopoverStub).vm.$emit('didDismiss');
    await flushPromises();
    expect(bar.get('[data-testid="apps-launcher-app"]').text()).toContain('Sales');
  });

  it('the hub without the bell keeps «My apps» and its piece in the bar: two buttons fit', () => {
    expect(inBar(mountBar(true, { ...HUB, actionNotices: undefined }))).toEqual(['topbar-apps', 'project-topbar']);
  });

  it('the SaaS (no side menu): its piece and the bell fit, and nothing folds', () => {
    expect(inBar(mountBar(true, SAAS))).toEqual(['project-topbar', 'action-bell']);
  });

  it('the SaaS with an action of the view: the action and the piece go into «⋮», the bell stays', async () => {
    const bar = mountBar(true, SAAS, { actions: ['edit'] });
    expect(inBar(bar)).toEqual(['topbar-more', 'action-bell']);
    expect((await openMore(bar)).findAll('[data-testid]').map((row) => row.attributes('data-testid'))).toEqual([
      'edit',
      'project-topbar',
    ]);
  });

  // With «⋮», the help a project adds beside the bell and the bell's pill, «Automatizaciones» read «Automatizaci…» at
  // 375 px: on a phone the bell takes the room of one button, its count a badge on its corner.
  it('the bell takes the room of one button on a phone, and is its pill wider', () => {
    expect(mountBar(true, HUB).get('[data-testid="action-bell"]').classes()).toContain('is-compact');
    expect(mountBar(true, SAAS).get('[data-testid="action-bell"]').classes()).toContain('is-compact');
    expect(mountBar(false, HUB).get('[data-testid="action-bell"]').classes()).not.toContain('is-compact');
  });

  it('wider than a phone, all of it stays in the bar: the actions, «My apps», the piece and the bell', () => {
    const bar = mountBar(false, HUB, { actions: ['edit', 'done'] });
    expect(inBar(bar)).toEqual(['edit', 'done', 'topbar-apps', 'project-topbar', 'action-bell']);
    expect(bar.get('[data-testid="project-topbar"]').text()).toBe('');
  });
});
