// The shell's router. Ported from ERPlora hub `apps/web/src/router/index.ts` (origin/develop),
// phase-1 minimum: Ionic's `createRouter` (IonRouterOutlet stacks and animates with it), the app
// routes (each `routes.ts` maps routes → pages), the catch-all 404 and the auth gate.
//
// Not ported: courier scrubbing and the entitlement/activation gates (the SaaS ↔ Hub handoff is
// phase 2), view-load recovery (hub#1518) and the Android back button (hub#1906).
import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteLocationNormalized, Router, RouteRecordRaw, RouterHistory } from 'vue-router';

import { type ShellSession, sessionReady } from './session';

declare module 'vue-router' {
  interface RouteMeta {
    /** The screen needs a signed-in person; without one the gate sends to the login page. */
    auth?: boolean;
    /** `false`: the screen paints its own frame (an account screen such as the SaaS launcher), so the
     *  shell's menu stays away even behind a session. Default: the chrome, where a session is required. */
    chrome?: boolean;
  }
}

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

export interface ShellRouterOptions {
  session: ShellSession;
  /** Where to sign in, outside the SPA; it may carry its own query (hub: the SaaS's login of the hub). Default `/login`. */
  loginPath?: string;
  /** Leaves the SPA for `url` (a full page load). Injectable for tests. */
  redirect?: (url: string) => void;
  /** Default `createWebHistory()`. */
  history?: RouterHistory;
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

/** Ionic router with the app routes, the 404 catch-all appended last and the auth gate. */
export function createShellRouter(routes: RouteRecordRaw[], options: ShellRouterOptions): Router {
  const router = createRouter({
    history: options.history ?? createWebHistory(),
    routes: [...routes, NOT_FOUND_ROUTE],
  });
  router.beforeEach(createAuthGate(options.session, options));
  return router;
}
