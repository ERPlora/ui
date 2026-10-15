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

// PLAN-MIGRATIONS §13 (Ioan, 2026-10-15): the hub's shell is the old hub's. No side menu at any
// width; the topbar carries the way around: Back on the left whenever the screen is not Home, the
// title in the middle, and on the right the view's actions, the ⠿ «My apps» sheet and the user.
describe('AppTopbar with nav launcher (the hub)', () => {
  const ME: SessionMe = {
    user: { id: 'u1', label: 'Ana Pérez' },
    permissions: ['demo.view'],
    menu: [{ id: 'demo', label: 'Demo', items: [{ path: '/demo/items', label: 'Items', icon: 'ion:flask-outline' }] }],
    apps: [{ label: 'demo', state: 'on' }],
    language: 'en',
  };

  let launcherRouter: Router;

  beforeEach(async () => {
    launcherRouter = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' }, meta: { auth: true } },
        { path: '/demo/items', component: { template: '<div />' }, meta: { auth: true } },
        { path: '/demo/items/:id', component: { template: '<div />' }, meta: { auth: true } },
        { path: '/welcome', component: { template: '<div />' }, meta: { auth: true, chrome: false } },
      ],
    });
    await launcherRouter.push('/demo/items');
  });

  function mountLauncherTopbar(
    props: Record<string, unknown> = {},
    { locale = 'en', me = ME as SessionMe | null, config = {} as Partial<ShellConfig>, slots = {} } = {},
  ) {
    return mount(AppTopbar, {
      props: { title: 'Items', ...props },
      slots,
      global: {
        plugins: [launcherRouter, createShellI18n({ locale })],
        provide: {
          [SHELL_CONFIG_KEY as symbol]: { homePath: '/', nav: 'launcher', ...config },
          [SESSION_KEY as symbol]: createShellSession(ref(me ?? undefined), ref('live')),
        },
        stubs: { IonModal: IonModalStub, IonPopover: PopoverStub },
      },
    });
  }

  const start = (wrapper: ReturnType<typeof mountLauncherTopbar>) => wrapper.get('ion-buttons[slot="start"]');
  const end = (wrapper: ReturnType<typeof mountLauncherTopbar>) => wrapper.get('ion-buttons[slot="end"]');

  it('has no menu button: there is no side menu to open', () => {
    expect(mountLauncherTopbar().find('ion-menu-button').exists()).toBe(false);
  });

  // The SaaS stays on the side menu: with a person signed in on an authenticated screen, the bar
  // keeps the menu button and paints neither the apps nor the user (they live in the side menu).
  describe('with nav menu (the SaaS), signed in on an authenticated screen', () => {
    it.each([
      ['nav unset', { nav: undefined }],
      ["nav: 'menu'", { nav: 'menu' as const }],
    ])('%s: the menu button, and no apps, no user button and no user menu', (_label, config) => {
      const wrapper = mountLauncherTopbar({}, { config });
      expect(wrapper.find('ion-menu-button').exists()).toBe(true);
      expect(wrapper.find('[data-testid="topbar-apps"]').exists()).toBe(false);
      expect(wrapper.find('[data-testid="topbar-user"]').exists()).toBe(false);
      expect(wrapper.findComponent(UserMenuPopover).exists()).toBe(false);
    });
  });

  // hub#1831: on a phone the way out showed late, waiting for an `ion-menu` to register. Back and
  // the apps are plain buttons, there on the first paint.
  it('paints Back on the left and the apps and the user on the right, on the first paint', () => {
    const wrapper = mountLauncherTopbar();
    expect(start(wrapper).find('[data-testid="topbar-back"]').exists()).toBe(true);
    expect(end(wrapper).find('[data-testid="topbar-apps"]').exists()).toBe(true);
    expect(end(wrapper).find('[data-testid="topbar-user"]').exists()).toBe(true);
  });

  it('keeps the view actions first on the right, then the apps, then the user', () => {
    const wrapper = mountLauncherTopbar({}, { slots: { actions: '<button class="new-item">New</button>' } });
    const order = end(wrapper)
      .findAll('.new-item, [data-testid="topbar-apps"], [data-testid="topbar-user"]')
      .map((el) => el.attributes('data-testid') ?? 'actions');
    expect(order).toEqual(['actions', 'topbar-apps', 'topbar-user']);
  });

  it('shows Back on the root screen of an app (no backHref), and never on Home', async () => {
    expect(mountLauncherTopbar().find('[data-testid="topbar-back"]').exists()).toBe(true);
    await launcherRouter.push('/');
    const home = mountLauncherTopbar({ title: 'Home' });
    expect(home.find('[data-testid="topbar-back"]').exists()).toBe(false);
    // The start group stays, empty: both groups share the row, so the title stays centred.
    expect(home.find('ion-buttons[slot="start"]').exists()).toBe(true);
  });

  it('Home is the configured one: Back hides on homePath', async () => {
    await launcherRouter.push('/demo/items/1');
    expect(mountLauncherTopbar({}, { config: { homePath: '/demo/items/1' } }).find('[data-testid="topbar-back"]').exists()).toBe(false);
  });

  it('Back goes back in history when there is a previous screen', async () => {
    window.history.replaceState({ back: '/' }, '');
    const back = vi.spyOn(launcherRouter, 'back').mockImplementation(() => {});
    const push = vi.spyOn(launcherRouter, 'push');
    await mountLauncherTopbar().get('[data-testid="topbar-back"]').trigger('click');
    expect(back).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });

  it('Back from the root of an app opened by a link goes Home', async () => {
    await mountLauncherTopbar().get('[data-testid="topbar-back"]').trigger('click');
    await flushPromises();
    expect(launcherRouter.currentRoute.value.path).toBe('/');
  });

  it('an empty backHref is no backHref: Back from a link still goes Home', async () => {
    await mountLauncherTopbar({ backHref: '' }).get('[data-testid="topbar-back"]').trigger('click');
    await flushPromises();
    expect(launcherRouter.currentRoute.value.path).toBe('/');
  });

  it('Back from a detail opened by a link goes to its backHref', async () => {
    await launcherRouter.push('/demo/items/1');
    await mountLauncherTopbar({ backHref: '/demo/items' }).get('[data-testid="topbar-back"]').trigger('click');
    await flushPromises();
    expect(launcherRouter.currentRoute.value.path).toBe('/demo/items');
  });

  it('the user button is the avatar, named «User menu», and opens the user menu under it', async () => {
    const wrapper = mountLauncherTopbar();
    const user = wrapper.get('[data-testid="topbar-user"]');
    expect(user.attributes('aria-label')).toBe('User menu');
    expect(user.attributes('aria-haspopup')).toBe('dialog');
    expect(user.attributes('aria-expanded')).toBe('false');
    expect(user.get('.user-avatar').text()).toBe('AP');
    expect(user.get('.user-avatar').attributes('aria-hidden')).toBe('true');
    expect(wrapper.getComponent(UserMenuPopover).props('alignment')).toBe('end');
    await user.trigger('click');
    expect(user.attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('[data-stub="ion-popover"]').exists()).toBe(true);
    wrapper.getComponent(UserMenuPopover).vm.$emit('dismiss');
    await flushPromises();
    expect(user.attributes('aria-expanded')).toBe('false');
  });

  it('names every button in the user language; nothing in the bar goes unnamed', () => {
    const wrapper = mountLauncherTopbar();
    expect(wrapper.get('[data-testid="topbar-back"]').attributes('aria-label')).toBe('Back');
    expect(wrapper.get('[data-testid="topbar-apps"]').attributes('aria-label')).toBe('My apps');
    expect(wrapper.get('[data-testid="topbar-back"]').getComponent(HubIcon).attributes('aria-hidden')).toBe('true');
    expect(unnamedIcons(wrapper.element)).toEqual([]);
    expect(unnamedButtons(wrapper.element)).toEqual([]);
    const es = mountLauncherTopbar({}, { locale: 'es' });
    expect(es.get('[data-testid="topbar-back"]').attributes('aria-label')).toBe('Atrás');
    expect(es.get('[data-testid="topbar-apps"]').attributes('aria-label')).toBe('Mis apps');
    expect(es.get('[data-testid="topbar-user"]').attributes('aria-label')).toBe('Menú de usuario');
  });

  // hub#925: a screen that asks for credentials, or paints its own frame, shows none of the
  // authenticated chrome: no apps and no user (the same gate as the side menu, useChromeVisible).
  it('without a person signed in, or on a screen with its own frame, no apps and no user', async () => {
    const anonymous = mountLauncherTopbar({}, { me: null });
    expect(anonymous.find('[data-testid="topbar-apps"]').exists()).toBe(false);
    expect(anonymous.find('[data-testid="topbar-user"]').exists()).toBe(false);
    await launcherRouter.push('/welcome');
    const framed = mountLauncherTopbar();
    expect(framed.find('[data-testid="topbar-apps"]').exists()).toBe(false);
    expect(framed.find('[data-testid="topbar-user"]').exists()).toBe(false);
  });

  // hub#690: on a phone (ios) the icons covered the title. Every button of the bar lives in one of
  // the two `ion-buttons` groups the scoped rules size (see «a long title never covers the buttons»),
  // so the title keeps the room between them and is cut with «…» instead.
  it('every button sits in a scoped button group, so none of them covers the title', () => {
    const wrapper = mountLauncherTopbar({}, { slots: { actions: '<button class="new-item">New</button>' } });
    const scope = (element: Element) => element.getAttributeNames().filter((name) => name.startsWith('data-v-'));
    const [id] = scope(wrapper.get('ion-header').element);
    for (const testid of ['topbar-back', 'topbar-apps', 'topbar-user']) {
      const group = wrapper.get(`[data-testid="${testid}"]`).element.closest('ion-buttons');
      expect(group, testid).not.toBeNull();
      expect(scope(group as Element)).toContain(id);
    }
  });
});
