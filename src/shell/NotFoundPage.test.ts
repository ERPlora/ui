import { mount } from '@vue/test-utils';
import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { describe, expect, it } from 'vitest';

import EmptyState from '../components/EmptyState/EmptyState.vue';
import AppPage from './AppPage.vue';
import { createShellI18n } from './i18n';
import NotFoundPage from './NotFoundPage.vue';
import { provideShellConfig } from './shell-config';

function mountNotFound(locale = 'en', homePath?: string) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  const provides: Record<symbol, unknown> = {};
  if (homePath) {
    const app = createApp({});
    provideShellConfig({ homePath }, app);
    Object.assign(provides, app._context.provides);
  }
  return mount(NotFoundPage, { global: { plugins: [router, createShellI18n({ locale })], provide: provides } });
}

describe('NotFoundPage (hub#1723: an unknown address says so, inside the shell, with one way out)', () => {
  it('is painted inside the shell layout, titled in the user language', () => {
    const page = mountNotFound().findComponent(AppPage);
    expect(page.props('title')).toBe('This page does not exist');
    expect(page.props('contentLayout')).toBe('detail');
    expect(mountNotFound('es').findComponent(AppPage).props('title')).toBe('Esta página no existe');
  });

  it('explains it with an empty state and offers ONE way out: Home', () => {
    const wrapper = mountNotFound();
    const empty = wrapper.getComponent(EmptyState);
    expect(empty.attributes('data-testid')).toBe('not-found');
    expect(empty.props('heading')).toBe('This page does not exist');
    expect(empty.props('message')).toContain('not part of this hub');
    expect(empty.props('icon')).toBe('help-circle-outline');
    const home = empty.get('.action [data-testid="not-found-home"]');
    expect(home.text()).toBe('Go to Home');
    expect(home.attributes('routerlink')).toBe('/');
  });

  it('Home is the one the app configured', () => {
    expect(mountNotFound('en', '/demo/items').get('[data-testid="not-found-home"]').attributes('routerlink')).toBe(
      '/demo/items',
    );
  });
});
