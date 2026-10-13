import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it, vi } from 'vitest';

import AppPage from './AppPage.vue';
import AppTopbar from './AppTopbar.vue';
import HubIcon from './HubIcon.vue';
import { createShellI18n } from './i18n';
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
