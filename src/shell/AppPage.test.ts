import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';

import AppPage from './AppPage.vue';
import AppTopbar from './AppTopbar.vue';
import { createShellI18n } from './i18n';

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
