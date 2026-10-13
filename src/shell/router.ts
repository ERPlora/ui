// The shell's router. Ported from ERPlora hub `apps/web/src/router/index.ts` (origin/develop),
// phase-1 minimum: Ionic's `createRouter` (IonRouterOutlet stacks and animates with it), the app
// routes (each `routes.ts` maps routes → pages), the shell's Home at `/` (the hub's, `home`), the
// catch-all 404, the auth gate and the web-only gate (a route that sells is not in the apps,
// PLAN-SAAS §3.6 point 5).
//
// Not ported: courier scrubbing and the entitlement/activation gates (the SaaS ↔ Hub handoff is
// phase 2), view-load recovery (hub#1518) and the Android back button (hub#1906).
import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteLocationNormalized, RouteLocationRaw, Router, RouteRecordRaw, RouterHistory } from 'vue-router';

import { type ShellSession, sessionReady } from './session';
import { useSurface } from './surface';

declare module 'vue-router' {
  interface RouteMeta {
    /** The screen needs a signed-in person; without one the gate sends to the login page. */
    auth?: boolean;
    /** `false`: the screen paints its own frame (an account screen such as the SaaS launcher), so the
     *  shell's menu stays away even behind a session. Default: the chrome, where a session is required. */
    chrome?: boolean;
    /** The screen sells (the SaaS's Store): on the app surfaces the shell mounts NotInAppPage instead,
     *  keeping the address (`surface.ts`). */
    webOnly?: boolean;
  }
}

/**
 * Home: the apps of the hub as a grid (Odoo's home). Where the login lands when it has no `next`
 * (`safe_next` falls back to `/`), so a hub never opens on the 404. Only with `home` (the hub: the
 * SaaS has its own landing). An app route at `/` wins: it is registered first, and vue-router keeps
 * the first of two equal paths.
 */
export const HOME_ROUTE: RouteRecordRaw = {
  path: '/',
  name: 'home',
  component: () => import('./HomePage.vue'),
  meta: { auth: true },
};

/**
 * Catch-all: an address this hub does NOT have says so (hub#1723). A `component` and not a
 * `redirect`, so the requested address stays in the bar and the typo can be read back. Behind a
 * session like the rest of the shell: a stranger with a broken link sees the login, not the chrome.
 */
export const NOT_FOUND_ROUTE: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'not-found',
  component: () => import('./NotFoundPage.vue'),
  meta: { auth: true },
};

/**
 * What a web-only route shows on the app surfaces. Reached only by name, from the web-only gate: it
 * is registered AFTER the 404, which keeps every address that matches no route (equal paths match in
 * order of registration).
 */
export const NOT_IN_APP_ROUTE: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'not-in-app',
  component: () => import('./NotInAppPage.vue'),
  meta: { auth: true },
};

/**
 * A route with `meta.webOnly`, off the web: the same address, NotInAppPage mounted (a redirect would
 * rewrite the address and lose where the link pointed).
 */
export function webOnlyGate(to: RouteLocationNormalized): true | RouteLocationRaw {
  if (!to.meta.webOnly || useSurface().isWeb.value) return true;
  return { name: NOT_IN_APP_ROUTE.name, params: { pathMatch: to.path.slice(1).split('/') }, query: to.query, hash: to.hash };
}

export interface ShellRouterOptions {
  session: ShellSession;
  /** Where to sign in, outside the SPA; it may carry its own query (hub: the SaaS's login of the hub). Default `/login`. */
  loginPath?: string;
  /** Leaves the SPA for `url` (a full page load). Injectable for tests. */
  redirect?: (url: string) => void;
  /** Default `createWebHistory()`. */
  history?: RouterHistory;
  /** Serve the shell's Home at `/` (HOME_ROUTE, the hub). Default off: the SaaS has its own landing. */
  home?: boolean;
}

/**
 * Routes with `meta.auth` need `session.user`. Without one, the whole page goes to the login with
 * `next=` (Django's parameter; `&next=` when the login URL has a query) and the navigation is cancelled. It waits for `base.session.me`
 * first (hub#858): deciding before it arrives sent people with a live session to the login.
 */
export function createAuthGate(
  session: ShellSession,
  { loginPath = '/login', redirect = (url: string) => window.location.assign(url) }: Omit<ShellRouterOptions, 'session' | 'history'> = {},
): (to: RouteLocationNormalized) => Promise<boolean> {
  return async (to) => {
    if (!to.meta.auth) return true;
    await sessionReady(session);
    if (session.user.value) return true;
    const separator = loginPath.includes('?') ? '&' : '?';
    redirect(`${loginPath}${separator}next=${encodeURIComponent(to.fullPath)}`);
    return false;
  };
}

/**
 * Ionic router with the app routes, then Home (with `home`), the 404 catch-all appended last, the
 * auth gate and the web-only gate.
 */
export function createShellRouter(routes: RouteRecordRaw[], options: ShellRouterOptions): Router {
  const router = createRouter({
    history: options.history ?? createWebHistory(),
    routes: [...routes, ...(options.home ? [HOME_ROUTE] : []), NOT_FOUND_ROUTE, NOT_IN_APP_ROUTE],
  });
  router.beforeEach(createAuthGate(options.session, options));
  router.beforeEach(webOnlyGate);
  return router;
}
