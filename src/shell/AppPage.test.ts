import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { flushPromises, mount } from '@vue/test-utils';
import { h, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

import AppPage from './AppPage.vue';
import AppTopbar from './AppTopbar.vue';
import HubIcon from './HubIcon.vue';
import { createShellI18n } from './i18n';
import { createShellSession, SESSION_KEY, type SessionMe } from './session';
import { SHELL_CONFIG_KEY } from './shell-config';
import { applySurface } from './surface';

function mountPage(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  return mount(AppPage, {
    props: { title: 'Items', ...props },
    slots: { default: '<p class="body">content</p>', ...slots },
    global: { plugins: [router, createShellI18n({ locale: 'en' })] },
  });
}

describe('AppPage (ADR-0045: the single layout of the shell screens)', () => {
  it('is an ion-page with the shared topbar and ONE ion-content holding the view', () => {
    const wrapper = mountPage();
    expect(wrapper.classes()).toContain('ion-page');
    expect(wrapper.findComponent(AppTopbar).props('title')).toBe('Items');
    const contents = wrapper.findAll('ion-content');
    expect(contents).toHaveLength(1);
    expect(contents[0].classes()).toContain('ion-padding');
    expect(contents[0].find('.body').exists()).toBe(true);
  });

  it('keeps the content strictly between topbar and footer (fullscreen off: the rounded card of polish.css)', () => {
    const content = mountPage().get('ion-content').element as HTMLElement & { fullscreen?: boolean };
    expect(content.fullscreen).toBe(false);
  });

  it('forwards backHref and the heading opt-out to the topbar', () => {
    const topbar = mountPage({ backHref: '/demo/items', headingOnScreen: true }).findComponent(AppTopbar);
    expect(topbar.props('backHref')).toBe('/demo/items');
    expect(topbar.props('titleIsHeading')).toBe(false);
  });

  it('forwards the actions slot to the topbar', () => {
    const wrapper = mountPage({}, { actions: '<button class="new-item">New</button>' });
    expect(wrapper.find('ion-header ion-buttons[slot="end"] .new-item').exists()).toBe(true);
  });

  it('fluid by default; detail layouts wrap the view in hub-detail-shell', () => {
    expect(mountPage().find('.hub-detail-shell').exists()).toBe(false);
    expect(mountPage({ contentLayout: 'detail' }).find('ion-content .hub-detail-shell .body').exists()).toBe(true);
    expect(mountPage({ contentLayout: 'detail-fill' }).get('.hub-detail-shell').classes()).toContain(
      'hub-detail-shell--fill',
    );
  });

  it('`fill`: a list page; the view is a `.page-fill` stack inside the detail-fill box, so a DataTable `fill` reaches the tabbar', () => {
    const wrapper = mountPage({ contentLayout: 'fill' }, { default: '<p class="kpis">kpis</p><div class="list">list</div>' });
    const shell = wrapper.get('ion-content > .hub-detail-shell');
    expect(shell.classes()).toEqual(['hub-detail-shell', 'hub-detail-shell--fill']);
    const stack = shell.get(':scope > .page-fill');
    expect(stack.classes()).toEqual(['page-fill']);
    expect([...stack.element.children].map((el) => el.className)).toEqual(['kpis', 'list']);
    // The other layouts carry no stack.
    for (const contentLayout of ['fluid', 'detail', 'detail-fill']) {
      expect(mountPage({ contentLayout }).find('.page-fill').exists(), contentLayout).toBe(false);
    }
  });

  it('renders the footer slot after the content (tabbar / sheet actions)', () => {
    const wrapper = mountPage({}, { footer: '<ion-footer class="page-footer"></ion-footer>' });
    const children = Array.from((wrapper.element as HTMLElement).children).map((el) => el.tagName.toLowerCase());
    expect(children.indexOf('ion-footer')).toBeGreaterThan(children.indexOf('ion-content'));
  });
});

// Section tabbar (mockups README §3: «las secciones van en la tabbar de pie, y cada pestaña lleva su
// icono»): `ion-footer > ion-toolbar > ion-segment.tabbar`, the Hub's footer strip (ADR-0022), wired by
// `bindTabbar` + `bindTabbarPeek` (AppPage.tabbar-binding.test.ts).
describe('AppPage: section tabbar', () => {
  type Tab = { id: string; label: string; icon: string; to?: string; webOnly?: boolean };
  const TABS: Tab[] = [
    { id: 'invoices', label: 'Invoices', icon: 'ion:receipt-outline' },
    { id: 'subscriptions', label: 'Subscriptions', icon: 'ion:sync-outline' },
    { id: 'payment', label: 'Payment details', icon: 'ion:card-outline' },
  ];

  function mountTabs(props: Record<string, unknown> = {}) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/account/:tab', component: { template: '<div />' } },
      ],
    });
    const wrapper = mount(AppPage, {
      props: { title: 'Billing', tabs: TABS, ...props },
      slots: { default: '<p class="body">content</p>' },
      global: { plugins: [router, createShellI18n({ locale: 'en' })] },
    });
    return { wrapper, router };
  }

  const segmentOf = (wrapper: ReturnType<typeof mount>) =>
    wrapper.get('ion-footer.section-tabbar > ion-toolbar > ion-segment').element as HTMLElement & { value?: string };
  const buttonsOf = (wrapper: ReturnType<typeof mount>) => wrapper.findAll('ion-segment.tabbar ion-segment-button');

  it('renders no tabbar without tabs, nor with an empty list', () => {
    expect(mountPage().find('ion-footer').exists()).toBe(false);
    expect(mountTabs({ tabs: [] }).wrapper.find('ion-footer').exists()).toBe(false);
  });

  it('renders one ion-segment-button per tab, after the content, each with its icon and its label', async () => {
    const { wrapper } = mountTabs();
    const segment = segmentOf(wrapper);
    expect(segment.classList.contains('tabbar')).toBe(true);
    const buttons = buttonsOf(wrapper);
    expect(buttons.map((b) => (b.element as HTMLElement & { value?: string }).value)).toEqual(['invoices', 'subscriptions', 'payment']);
    expect(buttons.map((b) => b.findComponent(HubIcon).props('name'))).toEqual(['ion:receipt-outline', 'ion:sync-outline', 'ion:card-outline']);
    // Stencil's slot patch hides `textContent` of ion-label under happy-dom: read its markup.
    expect(buttons.map((b) => b.get('ion-label').element.innerHTML.trim())).toEqual(['Invoices', 'Subscriptions', 'Payment details']);
    const children = Array.from((wrapper.element as HTMLElement).children).map((el) => el.tagName.toLowerCase());
    expect(children.indexOf('ion-footer')).toBeGreaterThan(children.indexOf('ion-content'));
  });

  it('the strip is a labelled tab list the keyboard reaches: a name for it, a name for each tab, no tab taken out of the order', async () => {
    const { wrapper } = mountTabs();
    expect(segmentOf(wrapper).getAttribute('aria-label')).toBe('Sections');
    for (const button of buttonsOf(wrapper)) {
      expect(button.attributes('tabindex')).not.toBe('-1');
      expect(button.attributes('disabled')).toBeUndefined();
    }
    const named = mountTabs({ tabsLabel: 'Billing sections' }).wrapper;
    expect(segmentOf(named).getAttribute('aria-label')).toBe('Billing sections');
  });

  it('v-model:tab — the segment shows the tab given and selecting one (finger, mouse or keyboard: Ionic emits ionChange) emits it', async () => {
    const { wrapper } = mountTabs({ tab: 'subscriptions' });
    expect(segmentOf(wrapper).value).toBe('subscriptions');
    segmentOf(wrapper).dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'payment' } }));
    await flushPromises();
    expect(wrapper.emitted('update:tab')).toEqual([['payment']]);
  });

  it('without v-model the first tab is the active one', () => {
    expect(segmentOf(mountTabs().wrapper).value).toBe('invoices');
  });

  it('tabs bound to a route: the active one is the route, and selecting one replaces the address (no history entry per tab)', async () => {
    const routed: Tab[] = [
      { id: 'profile', label: 'Profile', icon: 'ion:person-outline', to: '/account/profile' },
      { id: 'security', label: 'Security', icon: 'ion:lock-closed-outline', to: '/account/security' },
    ];
    const { wrapper, router } = mountTabs({ tabs: routed });
    await router.push('/account/security');
    await flushPromises();
    expect(segmentOf(wrapper).value).toBe('security');

    const replace = vi.spyOn(router, 'replace');
    segmentOf(wrapper).dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'profile' } }));
    await flushPromises();
    expect(replace).toHaveBeenCalledWith('/account/profile');
    expect(router.currentRoute.value.path).toBe('/account/profile');
    expect(segmentOf(wrapper).value).toBe('profile');
    expect(wrapper.emitted('update:tab')).toEqual([['profile']]);
  });

  it('selecting the tab already active does nothing', async () => {
    const { wrapper } = mountTabs({ tab: 'invoices' });
    segmentOf(wrapper).dispatchEvent(new CustomEvent('ionChange', { detail: { value: 'invoices' } }));
    await flushPromises();
    expect(wrapper.emitted('update:tab')).toBeUndefined();
  });

  it('the topbar says the section too («Billing · Invoices»)', async () => {
    const { wrapper } = mountTabs({ tab: 'subscriptions' });
    expect(wrapper.findComponent(AppTopbar).props('section')).toBe('Subscriptions');
    expect(mountPage().findComponent(AppTopbar).props('section')).toBeUndefined();
  });

  it('a web-only tab is not painted on the app surfaces', async () => {
    const tabs: Tab[] = [...TABS, { id: 'store', label: 'Store', icon: 'ion:storefront-outline', webOnly: true }];
    expect(buttonsOf(mountTabs({ tabs }).wrapper)).toHaveLength(4);
    applySurface('desktop');
    try {
      expect(buttonsOf(mountTabs({ tabs }).wrapper)).toHaveLength(3);
    } finally {
      applySurface('web');
    }
  });
});

// The height chain of a list page (Ioan, 2026-10-15, PLAN-MIGRATIONS §13: the DataTable takes the space
// between the topbar and the tabbar): ported from the SaaS's panel-fill.css (2026-10-14, measured there at
// 390, 834 and 1440 px), so the Hub and the SaaS share ONE stylesheet. Every ancestor needs a height,
// never a min-height: `detail-fill` gives the page's box its height; a `.panel-fill` stack takes it whole;
// what sits above and under the list keeps its height and the list takes the rest. happy-dom lays nothing
// out, so this reads the stylesheet.
describe('polish.css: the height chain of a list page (`.page-fill`, `.panel-fill`)', () => {
  const CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'theme/polish.css'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ');

  /** Every `@media (…)` block of the stylesheet with that condition, joined (polish.css has several). */
  function media(condition: string): string {
    const blocks: string[] = [];
    for (let start = CSS.indexOf(`@media ${condition} {`); start !== -1; start = CSS.indexOf(`@media ${condition} {`, start + 1)) {
      let depth = 0;
      for (let at = CSS.indexOf('{', start); at < CSS.length; at += 1) {
        if (CSS[at] === '{') depth += 1;
        if (CSS[at] === '}' && --depth === 0) {
          blocks.push(CSS.slice(CSS.indexOf('{', start) + 1, at));
          break;
        }
      }
    }
    return blocks.join(' } ');
  }

  /** The declarations of the rule with exactly that selector list in `css` (top level unless a block is given). */
  function rule(selector: string, css = CSS.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '')): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s*');
    const found = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`).exec(css);
    return found ? found[1].trim() : '';
  }

  const PHONE = '(max-width: 640px)';
  const DESK = '(min-width: 641px)';

  it('the page’s box has its height (detail-fill)', () => {
    expect(rule('.hub-detail-shell--fill')).toBe('height: 100%; min-height: var(--ep-work-surface-min);');
  });

  it('a stack takes its box whole, as a column; what sits above and under the list keeps its height (AppPage’s and the SaaS’s)', () => {
    expect(rule('.page-fill, .panel-fill')).toBe('display: flex; flex-direction: column; height: 100%; min-height: 0;');
    expect(rule('.page-fill > *, .panel-fill > *')).toBe('flex: 0 0 auto;');
  });

  it('on a desk or a tablet the list takes the rest, never less than a few rows (notices above push the page)', () => {
    // Stronger than DataTable's scoped `min-height: 0` of `.data-table--fill` (a class and its attribute).
    const lists =
      '.page-fill > .data-table.data-table--fill, .page-fill > .page-fill, .panel-fill > .data-table.data-table--fill, .panel-fill > .panel-fill';
    expect(rule(lists, media(DESK))).toBe('flex: 1 1 0; min-height: var(--panel-list-min, 20rem);');
    expect(rule(lists)).toBe('');
  });

  it('on a phone the list grows with its rows from the page’s height, as DataTable’s `fill` does there (one scroll)', () => {
    const phone = media(PHONE);
    const lists =
      '.page-fill > .data-table.data-table--fill, .page-fill > .page-fill, .panel-fill > .data-table.data-table--fill, .panel-fill > .panel-fill';
    expect(rule(lists, phone)).toBe('flex: 1 0 auto;');
    expect(rule('.page-fill > .page-fill, .panel-fill > .panel-fill', phone)).toBe('height: auto;');
    expect(phone).not.toMatch(/data-table__cards|data-table__surface|data-table__scroll/);
  });

  // The SaaS panel's own decisions (2026-10-14: R-14 and the phone heading) stay under its `.panel-fill`:
  // the Hub's pages (AppPage `fill`, `.page-fill`) keep the old hub's toolbar and their heading.
  it('the SaaS panel: on a phone a list with a search drops its heading (its topbar and tabbar name it)', () => {
    expect(rule('.panel-fill .data-table__bar-main:has(> .data-table__search) > .data-table__title-wrap', media(PHONE))).toBe('display: none;');
    expect(rule('.panel-fill .data-table__bar-main:has(> .data-table__search) > .data-table__title-wrap')).toBe('');
  });

  it('the SaaS panel: on a desk or a tablet the search gives way first, so the toolbar stays in one row from 834 to 1180 px (R-14)', () => {
    expect(rule('.panel-fill .data-table .data-table__search', media(DESK))).toBe('flex: 1 1 11rem; min-width: 9rem; max-width: 22rem;');
    expect(rule('.panel-fill .data-table .data-table__search')).toBe('');
  });

  it('a Hub list (AppPage `fill`) keeps its heading at 390 and its own search box: no SaaS-only rule reaches it', () => {
    const toolbar =
      '<div class="data-table data-table--fill"><div class="data-table__bar"><div class="data-table__bar-main">' +
      '<div class="data-table__title-wrap"><h2>Rules</h2></div><div class="data-table__search"></div></div></div></div>';
    const hub = mountPage({ contentLayout: 'fill' }, { default: toolbar });
    const saas = mount({ template: `<div class="panel-fill">${toolbar}</div>` });
    const onlySaas = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map((m) => m[1].trim())
      .filter((selector) => /data-table__title-wrap|data-table__search/.test(selector))
      .flatMap((selector) => selector.split(','))
      .map((selector) => selector.trim());
    expect(onlySaas.length).toBeGreaterThan(0);
    for (const selector of onlySaas) {
      expect(hub.get('.data-table__title-wrap').element.matches(selector) || hub.get('.data-table__search').element.matches(selector), selector).toBe(false);
      expect(saas.get('.data-table__title-wrap').element.matches(selector) || saas.get('.data-table__search').element.matches(selector), selector).toBe(true);
    }
  });
});

// APP-BASE-1: the project's notice over every screen (the hub's blocking strip, hub#374). It goes
// between the topbar and the scroller, as in the old hub's AppPage: a warning that scrolls away is not
// a warning. Authenticated chrome only (useChromeVisible); the piece decides itself when to paint.
describe('AppPage: the project notice', () => {
  const Strip = { name: 'ProjectStrip', render: () => h('div', { class: 'strip' }, 'You cannot invoice yet') };
  const ME: SessionMe = { user: { id: 'u1', label: 'Ana' }, permissions: [], menu: [], apps: [], language: 'en' };

  function mountWithNotice({ me = ME as SessionMe | null, auth = true, chrome = { notice: Strip } as object } = {}) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' }, meta: { auth } }],
    });
    void router.push('/');
    return router.isReady().then(() =>
      mount(AppPage, {
        props: { title: 'Items' },
        slots: { default: '<p class="body">content</p>' },
        global: {
          plugins: [router, createShellI18n({ locale: 'en' })],
          provide: {
            [SHELL_CONFIG_KEY as symbol]: { homePath: '/', chrome },
            [SESSION_KEY as symbol]: createShellSession(ref(me ?? undefined), ref('live')),
          },
        },
      }),
    );
  }

  it('mounts it between the topbar and ion-content, outside the scroller', async () => {
    const wrapper = await mountWithNotice();
    const children = [...wrapper.element.children].map((el) =>
      el.classList.contains('page-notice') ? 'notice' : el.tagName.toLowerCase(),
    );
    expect(children.slice(0, 3)).toEqual(['ion-header', 'notice', 'ion-content']);
    expect(wrapper.get('.page-notice').findComponent(Strip).exists()).toBe(true);
    expect(wrapper.get('ion-content').find('.strip').exists()).toBe(false);
  });

  it('mounts nothing without a person signed in, nor on a screen without the authenticated chrome', async () => {
    expect((await mountWithNotice({ me: null })).find('.page-notice').exists()).toBe(false);
    expect((await mountWithNotice({ auth: false })).find('.page-notice').exists()).toBe(false);
  });

  it('mounts nothing when the project has no notice (the SaaS)', async () => {
    const wrapper = await mountWithNotice({ chrome: {} });
    expect(wrapper.find('.page-notice').exists()).toBe(false);
    expect(wrapper.findComponent(Strip).exists()).toBe(false);
  });
});
