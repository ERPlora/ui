// The hub's side menu holds the platform's own entries; the modules open from the topbar's «My apps»
// and from Home. The SaaS passes no sidebar and keeps the menu of its session.
//
// An entry shows only when its screen exists (a route registered in the router), so the menu never
// links to the 404 and an entry appears by itself once its screen arrives; and only when its `visible`
// says so, so the menu never offers what the person cannot open.
import { computed, type ComputedRef, type MaybeRefOrGetter, shallowRef, toValue } from 'vue';
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
  /**
   * When it shows, besides its screen existing: a composable the shell calls once, in its setup (so it may use
   * `useSession()` or `useLive()`), whose value, read live, says whether it does. Without it, it shows.
   */
  visible?: () => MaybeRefOrGetter<boolean>;
}

export interface ShellSidebar {
  /** The entries, in groups; a divider between two groups. With `home`, «Home» opens the first one. */
  groups: ShellSidebarItem[][];
}

/**
 * The pinned menu folded to a rail of icons (≥lg): the topbar's toggle (AppTopbar) sets it and the
 * split pane takes `.rail` (App.vue). Not remembered across page loads.
 */
export const railCollapsed = shallowRef(false);

/** Does `path` open a screen of this router, and not the 404 that catches every other address? */
function hasScreen(router: Router, path: string): boolean {
  const target = router.resolve(path);
  return target.matched.length > 0 && target.name !== NOT_FOUND_ROUTE.name;
}

/** The groups with only the entries whose screen exists and that `shown` lets through; a group left empty goes too. */
export function sidebarGroups(
  router: Router,
  sidebar: ShellSidebar,
  shown: (item: ShellSidebarItem) => boolean = () => true,
): ShellSidebarItem[][] {
  return sidebar.groups
    .map((group) => group.filter((item) => hasScreen(router, item.to) && shown(item)))
    .filter((group) => group.length > 0);
}

/** From a setup: runs each entry's `visible` once, and gives the groups as they can be painted, live. */
export function useSidebarGroups(router: Router, sidebar: ShellSidebar): ComputedRef<ShellSidebarItem[][]> {
  const visibility = new Map<ShellSidebarItem, MaybeRefOrGetter<boolean>>();
  for (const item of sidebar.groups.flat()) if (item.visible) visibility.set(item, item.visible());
  return computed(() =>
    sidebarGroups(router, sidebar, (item) => {
      const visible = visibility.get(item);
      return visible === undefined || toValue(visible);
    }),
  );
}
