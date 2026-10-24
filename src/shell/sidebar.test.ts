import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NOT_FOUND_ROUTE, NOT_IN_APP_ROUTE } from './router';
import { railCollapsed, type ShellSidebarItem, sidebarGroups } from './sidebar';

const page = { template: '<div />' };

const item = (id: string, to: string): ShellSidebarItem => ({ id, labelKey: `nav.${id}`, icon: 'ion:home-outline', to });

let router: Router;

beforeEach(() => {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page },
      { path: '/employees', component: page },
      { path: '/employees/:id', component: page },
      { path: '/settings', component: page },
      NOT_FOUND_ROUTE,
      NOT_IN_APP_ROUTE,
    ],
  });
});

afterEach(() => {
  railCollapsed.value = false;
});

// FIX-SHELL-SPLIT-PANE (PLAN-MIGRATIONS §16): the hub's side menu is the old hub's, and an entry only
// shows when its screen exists — never a link to the 404, never a «coming soon».
describe('sidebarGroups', () => {
  it('keeps an entry whose route is registered and drops one that would land on the 404', () => {
    const groups = sidebarGroups(router, {
      groups: [
        [item('home', '/'), item('employees', '/employees'), item('files', '/files')],
        [item('billing', '/billing'), item('settings', '/settings')],
      ],
    });
    expect(groups).toEqual([
      [item('home', '/'), item('employees', '/employees')],
      [item('settings', '/settings')],
    ]);
  });

  it('drops a group left without entries, so no divider stands alone', () => {
    const groups = sidebarGroups(router, {
      groups: [[item('home', '/')], [item('billing', '/billing'), item('system', '/system')], [item('settings', '/settings')]],
    });
    expect(groups).toEqual([[item('home', '/')], [item('settings', '/settings')]]);
  });

  it('without the 404 catch-all, an address no route matches is no destination either', () => {
    const bare = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: page }] });
    expect(sidebarGroups(bare, { groups: [[item('home', '/'), item('files', '/files')]] })).toEqual([[item('home', '/')]]);
  });

  it('is empty when no entry has a screen', () => {
    expect(sidebarGroups(router, { groups: [[item('files', '/files')], [item('system', '/system')]] })).toEqual([]);
  });

  // APP-BASE-5: an entry may say when it shows (`visible`): the person may open its screen, or a setting
  // is on. What does not show goes like a missing screen, and so does a group left empty.
  it('drops an entry its predicate hides, and a group left without entries', () => {
    const hidden = new Set(['employees', 'settings']);
    const groups = sidebarGroups(
      router,
      { groups: [[item('home', '/'), item('employees', '/employees')], [item('settings', '/settings')]] },
      (entry) => !hidden.has(entry.id),
    );
    expect(groups).toEqual([[item('home', '/')]]);
  });
});

describe('railCollapsed', () => {
  it('starts expanded: the pinned menu shows its labels until the person folds it', () => {
    expect(railCollapsed.value).toBe(false);
  });
});
