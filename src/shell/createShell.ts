// `createShell()`: boots the Ionic Vue shell in the order of ERPlora hub `apps/web/src/main.ts`
// (origin/develop) and returns the app WITHOUT mounting it; the project's entry mounts after
// `router.isReady()`:
//
//   const { app, router } = await createShell({ routes, session, status });
//   await router.isReady();
//   app.mount('#app');
//
// 🔴 The three boot hooks are the FIRST imports, and the order is the fix (hub#1060): they hook
// `customElements.define` before `@ionic/vue` registers its `ion-*` on import, and the spec
// freezes a custom element's callbacks inside `define`. A call in this module's body would run
// after every import below, too late. Guard: `createShell.test.ts`.
import './boot/ionic-fill.boot';
import './boot/ionic-select-text.boot';
import './boot/ionic-select-interface.boot';

import { IonicVue } from '@ionic/vue';
import { addIcons } from 'ionicons';
import { type App, type Component, createApp, defineAsyncComponent, type Ref, watch } from 'vue';
import type { Router, RouteRecordRaw, RouterHistory } from 'vue-router';

// Ionic base CSS + utilities. Dark mode by class (`.ion-palette-dark`, set by `bootTheme`).
import '@ionic/vue/css/core.css';
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';
import '@ionic/vue/css/palettes/dark.class.css';
// Shell theme, in the Hub's order: print rules, brand variables, the optional palettes
// (`data-ep-palette`, after the variables to win the cascade), logo, footer tabbar, polish, globals.
// All of it is ours (PLAN §16.11): palettes and tabbar were ported from OutfitKit.
import './theme/print.css';
import './theme/variables.css';
import './theme/palettes.css';
import './theme/erplora-logo.css';
import './theme/tabbar.css';
import './theme/polish.css';
import './theme/global.css';

import AppRoot from './App.vue';
import { installTrustedTypesPolicy } from './boot/trusted-types.boot';
import { createShellI18n, type ShellI18nOptions, shellLocale } from './i18n';
import { ION_ICONS } from './icons';
import { createShellRouter } from './router';
import { provideSession, type SessionMe, type SessionStatus } from './session';
import { provideShellConfig, type ShellChrome } from './shell-config';
import type { ShellSidebar } from './sidebar';
import { bootSurface, type Surface } from './surface';
import { bootTheme, type ThemeContrast } from './theme';
import { provideUserMenu, type ShellUserMenu } from './user-menu';

export interface CreateShellOptions {
  /**
   * The app routes (each app's `routes.ts`); the 404 catch-all is appended by the shell. A route marked
   * `meta.background` is no screen: its component is the app's piece that runs on every screen, mounted beside the pane.
   */
  routes: RouteRecordRaw[];
  /** `base.session.me` (embedded JSON first, the live query from V7 on). */
  session: Ref<SessionMe | undefined>;
  /** State of the stream that carries it. */
  status: Ref<SessionStatus>;
  /** Where to sign in, outside the SPA (hub: `spa-config.loginUrl`, the SaaS's login). Default `/login`. */
  loginPath?: string;
  /** Path of «Home» (menu brand, 404). Default `/`. */
  homePath?: string;
  /**
   * The shell's Home (the hub): HomePage at `/`, the apps as a grid, and «Home» first in the menu.
   * Default off (the SaaS has its own landing and its own menu).
   */
  home?: boolean;
  /**
   * The hub's side menu (`sidebar.ts`, the old hub's): the platform's entries whose screen exists
   * instead of the session's menu, the QR «Open on your phone» in its footer, and in the topbar the
   * rail toggle and «My apps» (the modules are not in the menu). Default none: the SaaS's menu is
   * the one of its session.
   */
  sidebar?: ShellSidebar;
  /**
   * The project's pieces of the authenticated chrome (the hub's bell at the end of the topbar, «Upgrade
   * plan» in the side menu's footer and the blocking strip over every screen). Default none.
   */
  chrome?: ShellChrome;
  /** App catalogues (`en` + `es`), merged over the shell's. */
  messages?: ShellI18nOptions['messages'];
  /** Router history. Default `createWebHistory()`. */
  history?: RouterHistory;
  /**
   * The surface, when the entry knows it (the server's `spa-config`, PLAN-SAAS §3.6 point 5).
   * Default: detected (`surface.ts`: the Tauri bridge, the app user agent, `?surface=`,
   * `<html data-surface>`). It lands on `<html data-surface>` and, off the web, `html.in-app-shell`.
   */
  surface?: Surface;
  /** `'aa'`: the accessible colours (theme.ts). Default: `DEFAULT_THEME_CONTRAST`. */
  contrast?: ThemeContrast;
  /** The user menu: the project's entries, Help and Sign out (the theme is always there). */
  userMenu?: ShellUserMenu;
  /**
   * Where the script URLs the Trusted Types `default` policy admits may be, each a bare `https://host[:port]` or
   * one with a path ending in `/`, which admits that path and below only (`boot/trusted-types.boot.ts`). Default
   * none. The SaaS: `https://js.stripe.com` and `https://www.google.com/recaptcha/` +
   * `https://www.gstatic.com/recaptcha/` (Stripe.js and reCAPTCHA set their scripts' `src` without a policy of
   * their own); its CSP `script-src` still gates them.
   */
  trustedScriptOrigins?: readonly string[];
}

export async function createShell(options: CreateShellOptions): Promise<{ app: App; router: Router }> {
  // Before anything writes HTML: only `<svg>` goes through innerHTML in production, and a script URL
  // only from the origins the project trusts.
  installTrustedTypesPolicy(window, import.meta.env.DEV, options.trustedScriptOrigins ?? []);
  // The shell and the apps paint `<ion-icon name=…>`: without the registry it renders EMPTY offline
  // and under the CSP (ion-icon would try to fetch the SVG).
  addIcons(ION_ICONS);
  // Before the router's first navigation (its web-only gate reads it) and before the first paint.
  bootSurface({ surface: options.surface });

  const i18n = createShellI18n({
    locale: options.session.value?.language ?? document.documentElement.lang,
    messages: options.messages,
  });
  const app = createApp(AppRoot);
  const session = provideSession(options.session, options.status, { app });
  const screens = options.routes.filter((route) => route.meta?.background !== true);
  const backgrounds = options.routes.filter((route) => route.meta?.background === true).map(backgroundPiece);
  const router = createShellRouter(screens, {
    session,
    loginPath: options.loginPath,
    history: options.history,
    home: options.home,
  });
  app.use(IonicVue, { mode: 'ios', swipeBackEnabled: false }).use(router).use(i18n);
  provideShellConfig(
    {
      homePath: options.homePath,
      home: options.home,
      sidebar: options.sidebar,
      chrome: options.chrome,
      backgrounds: backgrounds.length > 0 ? backgrounds : undefined,
    },
    app,
  );
  provideUserMenu(options.userMenu, app);

  // The language is the person's (`base.session.me.language`): follow it live, and keep
  // `<html lang>` in step (screen readers, and the select-dialog hook reads it).
  watch(
    () => options.session.value?.language,
    (language) => {
      if (!language) return;
      const locale = shellLocale(language);
      i18n.global.locale.value = locale;
      document.documentElement.lang = locale;
    },
    { immediate: true },
  );

  bootTheme({ contrast: options.contrast });
  return { app, router };
}

/** The piece of a background route: its component, loaded on demand when it is a loader (`() => import(…)`). */
function backgroundPiece(route: RouteRecordRaw): Component {
  const component = (route as { component?: unknown }).component;
  if (typeof component === 'function' && !('setup' in component) && !('render' in component)) {
    return defineAsyncComponent(component as () => Promise<Component>);
  }
  return component as Component;
}
