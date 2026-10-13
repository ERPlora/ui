// NotInAppPage — a deep link to something that sells (the Store), opened inside the apps: a neutral
// screen that says so, with no price and no link out (PLAN-SAAS §3.6, point 5; mockups README §4:
// «La tienda no está en la app»), inside the shell layout and with ONE way out, Home.
import { mount } from '@vue/test-utils';
import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';

import EmptyState from '../components/EmptyState/EmptyState.vue';
import AppPage from './AppPage.vue';
import { createShellI18n } from './i18n';
import NotInAppPage from './NotInAppPage.vue';
import { provideShellConfig } from './shell-config';

function mountNotInApp(locale = 'en') {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  const app = createApp({});
  provideShellConfig({ homePath: '/businesses' }, app);
  return mount(NotInAppPage, {
    global: { plugins: [router, createShellI18n({ locale })], provide: app._context.provides as Record<symbol, unknown> },
  });
}

describe('NotInAppPage', () => {
  it('is painted inside the shell layout, titled in the user language', () => {
    const page = mountNotInApp().findComponent(AppPage);
    expect(page.props('title')).toBe('This page is not in the app');
    expect(page.props('contentLayout')).toBe('detail');
    expect(mountNotInApp('es').findComponent(AppPage).props('title')).toBe('Esta página no está en la app');
  });

  it('explains it with an empty state and offers ONE way out: Home', () => {
    const empty = mountNotInApp().getComponent(EmptyState);
    expect(empty.attributes('data-testid')).toBe('not-in-app');
    expect(empty.props('heading')).toBe('This page is not in the app');
    expect(empty.props('message')).toBe('This part of ERPlora is only available in a web browser.');
    expect(empty.props('icon')).toBe('globe-outline');
    const home = empty.get('.action [data-testid="not-in-app-home"]');
    expect(home.text()).toBe('Go to Home');
    expect(home.attributes('routerlink')).toBe('/businesses');
  });

  it('carries no link out of the app', () => {
    const wrapper = mountNotInApp();
    expect(wrapper.findAll('a[href], [href]')).toEqual([]);
    expect(wrapper.html()).not.toMatch(/https?:/);
  });
});
