// The hub's side menu (`createShell({ sidebar })`, PLAN-MIGRATIONS §16): the old hub's — the person at
// the top, the platform's own entries in groups (Home, Employees, Files · My plan, Apps, System,
// Settings), the QR «Open on your phone» in the footer, and a rail of icons the topbar folds it to from
// lg. No module goes in it: the modules open from the topbar's «My apps» and from Home. The SaaS passes
// no sidebar and keeps the menu of its session (`base.session.me`).
//
// An entry shows only when its screen exists — a route registered in the router — so the menu never
// links to the 404 nor promises a «coming soon»: an entry appears by itself once its screen arrives.
import { shallowRef } from 'vue';
import type { Router } from 'vue-router';

import { NOT_FOUND_ROUTE } from './router';

export interface ShellSidebarItem {
  /** Stable id (`data-testid="nav-<id>"`). */
  id: string;
  /** i18n key of its label, in the shell's catalogues or the ones merged by `createShell({ messages })`. */
  labelKey: string;
  /** `set:name`, painted with HubIcon. */
  icon: string;
  /** Route it opens. */
  to: string;
}

export interface ShellSidebar {
  /** The entries, in groups; a divider between two groups. With `home`, «Home» opens the first one. */
  groups: ShellSidebarItem[][];
}

/**
 * The pinned menu folded to a rail of icons (≥lg): the topbar's toggle (AppTopbar) sets it and the
 * split pane takes `.rail` (App.vue). For this page only, as the old hub had it.
 */
export const railCollapsed = shallowRef(false);

/** Does `path` open a screen of this router, and not the 404 that catches every other address? */
function hasScreen(router: Router, path: string): boolean {
  const target = router.resolve(path);
  return target.matched.length > 0 && target.name !== NOT_FOUND_ROUTE.name;
}

/** The groups with only the entries whose screen exists; a group left empty goes too. */
export function sidebarGroups(router: Router, sidebar: ShellSidebar): ShellSidebarItem[][] {
  return sidebar.groups
    .map((group) => group.filter((item) => hasScreen(router, item.to)))
    .filter((group) => group.length > 0);
}
