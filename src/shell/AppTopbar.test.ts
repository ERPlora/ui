import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import { parse } from 'vue/compiler-sfc';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { unnamedButtons, unnamedIcons } from '../testing/a11y';
import AppTopbar from './AppTopbar.vue';
import { IonModalStub } from '../components/FormModal/__tests__/ionModalStub';
import HubIcon from './HubIcon.vue';
import { createShellI18n } from './i18n';
import { createShellSession, SESSION_KEY, type SessionMe } from './session';
import { SHELL_CONFIG_KEY, type ShellConfig } from './shell-config';
import { railCollapsed } from './sidebar';
import UserMenuPopover from './UserMenuPopover.vue';

let router: Router;

beforeEach(async () => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/demo/items', component: { template: '<div />' } },
    ],
  });
  await router.push('/');
});

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '');
});

function mountTopbar(props: Record<string, unknown>, locale = 'en', slots = {}) {
  return mount(AppTopbar, {
    props: { title: 'Items', ...props },
    slots,
    global: { plugins: [router, createShellI18n({ locale })] },
  });
}

describe('AppTopbar', () => {
  it('is the flat shell header with the screen title as its level-1 heading (hub#794)', () => {
    const wrapper = mountTopbar({});
    expect(wrapper.get('ion-header').classes()).toEqual(expect.arrayContaining(['ion-no-border', 'app-topbar']));
    const title = wrapper.get('ion-title');
    expect(title.text()).toBe('Items');
    expect(title.attributes('role')).toBe('heading');
    expect(title.attributes('aria-level')).toBe('1');
  });

  it('says the section after the title, muted, inside the same heading («Billing · Invoices»)', () => {
    const title = mountTopbar({ title: 'Billing', section: 'Invoices' }).get('ion-title');
    const section = title.get('.topbar-section');
    expect(section.text()).toBe('Invoices');
    expect(title.text().replace(/\s+/g, ' ')).toBe('Billing Invoices');
    expect(mountTopbar({ title: 'Billing' }).find('.topbar-section').exists()).toBe(false);
  });

  it('drops the heading role when the view paints its own <h1>', () => {
    const title = mountTopbar({ titleIsHeading: false }).get('ion-title');
    expect(title.attributes('role')).toBeUndefined();
    expect(title.attributes('aria-level')).toBeUndefined();
  });

  it('always shows the menu button (auto-hide off, hub#1831), labelled in the user language', () => {
    const en = mountTopbar({}).get('ion-buttons[slot="start"] ion-menu-button');
    expect(en.classes()).toContain('menu-toggle');
    expect((en.element as HTMLElement & { autoHide?: boolean }).autoHide).toBe(false);
    expect(en.attributes('aria-label')).toBe('Open menu');
    expect(mountTopbar({}, 'es').get('ion-menu-button').attributes('aria-label')).toBe('Abrir menú');
  });

  it('has no back button when backHref is empty', () => {
    expect(mountTopbar({ backHref: '' }).find('[data-testid="topbar-back"]').exists()).toBe(false);
  });

  it('has no back button on a top-level screen', () => {
    expect(mountTopbar({}).find('[data-testid="topbar-back"]').exists()).toBe(false);
  });

  it('back button: goes to backHref on a deep link (no history inside the app)', async () => {
    const wrapper = mountTopbar({ backHref: '/demo/items' });
    const back = wrapper.get('[data-testid="topbar-back"]');
    expect(back.attributes('aria-label')).toBe('Back');
    expect((back.get('ion-icon').element as HTMLElement & { name?: string }).name).toBe('arrow-back-outline');
    await back.trigger('click');
    await router.isReady();
    await new Promise((r) => setTimeout(r));
    expect(router.currentRoute.value.path).toBe('/demo/items');
  });

  // R-03 (UX audit 2, 2026-10-14): the arrow was an unnamed `role="img"` inside the named button.
  it('back button: named by the button, its arrow decorative; nothing in the bar goes unnamed', () => {
    const wrapper = mountTopbar({ backHref: '/demo/items' });
    expect(wrapper.get('[data-testid="topbar-back"] ion-icon').attributes('aria-hidden')).toBe('true');
    expect(unnamedIcons(wrapper.element)).toEqual([]);
    expect(unnamedButtons(wrapper.element)).toEqual([]);
  });

  it('back button: goes back in history when there is a previous screen', async () => {
    window.history.replaceState({ back: '/' }, '');
    const back = vi.spyOn(router, 'back').mockImplementation(() => {});
    const push = vi.spyOn(router, 'push');
    await mountTopbar({ backHref: '/demo/items' }).get('[data-testid="topbar-back"]').trigger('click');
    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it('renders the view actions at the end of the toolbar', () => {
    const wrapper = mountTopbar({}, 'en', { actions: '<button class="new-item">New</button>' });
    expect(wrapper.find('ion-buttons[slot="end"] .new-item').exists()).toBe(true);
  });
});

// PoC issue C: at 390 px a long title covered the menu button and «Mark done»/«Delete». In ios
// Ionic lays the title `position: absolute` across the WHOLE toolbar and keeps it off the buttons
// with `padding: 0 90px`, which Tailwind's preflight wipes. Layout is not computed under happy-dom,
// so these check the component's own (scoped) rules and that they reach the rendered elements.
describe('AppTopbar: a long title never covers the buttons', () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'AppTopbar.vue'), 'utf8');
  const styles = parse(source).descriptor.styles;
  const css = styles
    .map((style) => style.content)
    .join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  /** Declarations of `selector` in the component's styles, whitespace-normalised. */
  function declarations(selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    const block = new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
    return block.replace(/\s+/g, ' ').trim();
  }

  it('puts the ios title back in the toolbar row, between the start and end buttons', () => {
    // Its own `.toolbar-title` already cuts with an ellipsis (nowrap + hidden + text-overflow):
    // inside the row, the room left between the buttons is all it gets.
    expect(declarations('.app-topbar ion-title.ios')).toContain('position: relative;');
    expect(declarations('.app-topbar ion-title.ios')).toContain('padding-inline: 4px;');
  });

  it('gives both button groups the same share of the row, so the title stays centred while it fits', () => {
    const buttons = declarations('.app-topbar ion-toolbar.ios > ion-buttons');
    expect(buttons).toContain('flex: 1 1 0;');
    // Never squeezed: a long title gives way, the buttons keep their labels on one line.
    expect(buttons).toContain('min-width: max-content;');
    expect(declarations(".app-topbar ion-toolbar.ios > ion-buttons[slot='end']")).toContain(
      'justify-content: flex-end;',
    );
  });

  it('scopes the rules to this component, and they reach the rendered title and button groups', () => {
    expect(styles.length).toBeGreaterThan(0);
    expect(styles.every((style) => style.scoped)).toBe(true);
    const wrapper = mountTopbar({ title: 'A very long item name that does not fit on a phone at all' });
    const scope = (element: Element) => element.getAttributeNames().filter((name) => name.startsWith('data-v-'));
    const [id] = scope(wrapper.get('ion-header').element);
    expect(id).toBeDefined();
    expect(scope(wrapper.get('ion-title').element)).toContain(id);
    for (const group of wrapper.findAll('ion-buttons')) expect(scope(group.element)).toContain(id);
  });
});

/** `ion-popover` presents itself only in a real browser: the stub shows its content while open. */
const PopoverStub = defineComponent({
  name: 'IonPopover',
  inheritAttrs: false,
  props: { isOpen: Boolean, event: { type: null, default: undefined }, alignment: { type: String, default: undefined } },
  emits: ['didDismiss'],
  setup(props, { slots, attrs }) {
    return () => (props.isOpen ? h('div', { ...attrs, 'data-stub': 'ion-popover' }, slots.default?.()) : null);
  },
});

// FIX-SHELL-SPLIT-PANE (PLAN-MIGRATIONS §16, Ioan 2026-10-17): the topbar of the old hub — the drawer
// button below lg, Back only on a detail (`backHref`: never on the screens of a module), the rail toggle
// from lg, the title centred and, at the end, the view's actions and the ⠿ «My apps». The person lives
// at the top of the side menu, not in the bar (hub#146).
describe("AppTopbar with the hub's sidebar", () => {
  const ME: SessionMe = {
    user: { id: 'u1', label: 'Ana Pérez' },
    permissions: ['demo.view'],
    menu: [{ id: 'demo', label: 'Demo', items: [{ path: '/demo/items', label: 'Items', icon: 'ion:flask-outline' }] }],
    apps: [{ label: 'demo', state: 'on' }],
    language: 'en',
  };
  const HUB: Partial<ShellConfig> = { homePath: '/', home: true, sidebar: { groups: [] } };

  let hubRouter: Router;

  beforeEach(async () => {
    hubRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' }, meta: { auth: true } },
        { path: '/demo/items', component: { template: '<div />' }, meta: { auth: true } },
        { path: '/demo/items/:id', component: { template: '<div />' }, meta: { auth: true } },
        { path: '/welcome', component: { template: '<div />' }, meta: { auth: true, chrome: false } },
      ],
    });
    await hubRouter.push('/demo/items');
  });

  afterEach(() => {
    railCollapsed.value = false;
  });

  function mountHubTopbar(
    props: Record<string, unknown> = {},
    { locale = 'en', me = ME as SessionMe | null, config = HUB, slots = {} } = {},
  ) {
    return mount(AppTopbar, {
      props: { title: 'Items', ...props },
      slots,
      global: {
        plugins: [hubRouter, createShellI18n({ locale })],
        provide: {
          [SHELL_CONFIG_KEY as symbol]: { homePath: '/', ...config },
          [SESSION_KEY as symbol]: createShellSession(ref(me ?? undefined), ref('live')),
        },
        stubs: { IonModal: IonModalStub, IonPopover: PopoverStub },
      },
    });
  }

  /** What the start group holds, in order: the menu button, Back and the rail toggle. */
  const startOrder = (wrapper: ReturnType<typeof mountHubTopbar>) =>
    wrapper
      .get('ion-buttons[slot="start"]')
      .findAll('ion-menu-button, [data-testid="topbar-back"], [data-testid="topbar-rail"]')
      .map((el) => el.attributes('data-testid') ?? 'menu');
  const end = (wrapper: ReturnType<typeof mountHubTopbar>) => wrapper.get('ion-buttons[slot="end"]');

  it('on a screen of a module: the drawer button and the rail toggle; no Back', () => {
    expect(startOrder(mountHubTopbar())).toEqual(['menu', 'topbar-rail']);
  });

  it('nor Back on Home', async () => {
    await hubRouter.push('/');
    expect(startOrder(mountHubTopbar({ title: 'Home' }))).toEqual(['menu', 'topbar-rail']);
  });

  it('Back on a detail (backHref), between the drawer button and the rail toggle, as the old hub', async () => {
    await hubRouter.push('/demo/items/1');
    const wrapper = mountHubTopbar({ backHref: '/demo/items' });
    expect(startOrder(wrapper)).toEqual(['menu', 'topbar-back', 'topbar-rail']);
    await wrapper.get('[data-testid="topbar-back"]').trigger('click');
    await flushPromises();
    expect(hubRouter.currentRoute.value.path).toBe('/demo/items');
  });

  it('the rail toggle folds the pinned menu to its icons and opens it again, saying which', async () => {
    const wrapper = mountHubTopbar();
    const rail = wrapper.get('[data-testid="topbar-rail"]');
    expect(rail.classes()).toContain('rail-toggle');
    expect(rail.getComponent(HubIcon).props('name')).toBe('lucide:panel-left');
    expect([rail.attributes('aria-label'), rail.attributes('aria-expanded')]).toEqual(['Collapse menu', 'true']);
    await rail.trigger('click');
    expect(railCollapsed.value).toBe(true);
    expect([rail.attributes('aria-label'), rail.attributes('aria-expanded')]).toEqual(['Expand menu', 'false']);
    await rail.trigger('click');
    expect(railCollapsed.value).toBe(false);
    expect(rail.attributes('aria-label')).toBe('Collapse menu');
  });

  it('at the end, the view actions and then the apps; no avatar: the person is in the side menu (hub#146)', () => {
    const wrapper = mountHubTopbar({}, { slots: { actions: '<button class="new-item">New</button>' } });
    const order = end(wrapper)
      .findAll('.new-item, [data-testid="topbar-apps"]')
      .map((el) => el.attributes('data-testid') ?? 'actions');
    expect(order).toEqual(['actions', 'topbar-apps']);
    expect(wrapper.find('[data-testid="topbar-user"]').exists()).toBe(false);
    expect(wrapper.findComponent(UserMenuPopover).exists()).toBe(false);
  });

  it('names every button in the user language; nothing in the bar goes unnamed', async () => {
    await hubRouter.push('/demo/items/1');
    const wrapper = mountHubTopbar({ backHref: '/demo/items' });
    expect(wrapper.get('[data-testid="topbar-apps"]').attributes('aria-label')).toBe('My apps');
    expect(unnamedIcons(wrapper.element)).toEqual([]);
    expect(unnamedButtons(wrapper.element)).toEqual([]);
    const es = mountHubTopbar({ backHref: '/demo/items' }, { locale: 'es' });
    expect(es.get('ion-menu-button').attributes('aria-label')).toBe('Abrir menú');
    expect(es.get('[data-testid="topbar-back"]').attributes('aria-label')).toBe('Atrás');
    expect(es.get('[data-testid="topbar-rail"]').attributes('aria-label')).toBe('Colapsar menú');
    expect(es.get('[data-testid="topbar-apps"]').attributes('aria-label')).toBe('Mis apps');
  });

  // hub#925: a screen that asks for credentials, or paints its own frame, shows none of the
  // authenticated chrome: no apps, and no rail of a menu that is not there (useChromeVisible).
  it('without a person signed in, or on a screen with its own frame, no apps and no rail toggle', async () => {
    const anonymous = mountHubTopbar({}, { me: null });
    expect(anonymous.find('[data-testid="topbar-apps"]').exists()).toBe(false);
    expect(anonymous.find('[data-testid="topbar-rail"]').exists()).toBe(false);
    await hubRouter.push('/welcome');
    const framed = mountHubTopbar();
    expect(framed.find('[data-testid="topbar-apps"]').exists()).toBe(false);
    expect(framed.find('[data-testid="topbar-rail"]').exists()).toBe(false);
  });

  // The SaaS stays as it is: the menu button, Back only on a detail, and neither apps nor rail.
  it('the SaaS (no sidebar), signed in on an authenticated screen: only the menu button', () => {
    const wrapper = mountHubTopbar({}, { config: { homePath: '/' } });
    expect(startOrder(wrapper)).toEqual(['menu']);
    expect(wrapper.find('[data-testid="topbar-apps"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="topbar-user"]').exists()).toBe(false);
  });

  // hub#690: on a phone (ios) the icons covered the title. Every button of the bar lives in one of
  // the two `ion-buttons` groups the scoped rules size (see «a long title never covers the buttons»),
  // so the title keeps the room between them and is cut with «…» instead.
  it('every button sits in a scoped button group, so none of them covers the title', async () => {
    await hubRouter.push('/demo/items/1');
    const wrapper = mountHubTopbar({ backHref: '/demo/items' }, { slots: { actions: '<button class="new-item">New</button>' } });
    const scope = (element: Element) => element.getAttributeNames().filter((name) => name.startsWith('data-v-'));
    const [id] = scope(wrapper.get('ion-header').element);
    for (const testid of ['topbar-back', 'topbar-rail', 'topbar-apps']) {
      const group = wrapper.get(`[data-testid="${testid}"]`).element.closest('ion-buttons');
      expect(group, testid).not.toBeNull();
      expect(scope(group as Element)).toContain(id);
    }
  });
});
