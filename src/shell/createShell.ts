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
import { type App, createApp, type Ref, watch } from 'vue';
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
import { provideShellConfig } from './shell-config';
import { bootTheme } from './theme';

export interface CreateShellOptions {
  /** The app routes (each app's `routes.ts`); the 404 catch-all is appended by the shell. */
  routes: RouteRecordRaw[];
  /** `base.session.me` (embedded JSON first, the live query from V7 on). */
  session: Ref<SessionMe | undefined>;
  /** State of the stream that carries it. */
  status: Ref<SessionStatus>;
  /** Where to sign in, outside the SPA (hub: `spa-config.loginUrl`, the SaaS's login). Default `/login`. */
  loginPath?: string;
  /** Path of «Home» (menu brand, 404). Default `/`. */
  homePath?: string;
  /** App catalogues (`en` + `es`), merged over the shell's. */
  messages?: ShellI18nOptions['messages'];
  /** Router history. Default `createWebHistory()`. */
  history?: RouterHistory;
}

export async function createShell(options: CreateShellOptions): Promise<{ app: App; router: Router }> {
  // Before anything writes HTML: only `<svg>` goes through innerHTML in production.
  installTrustedTypesPolicy();
  // The shell and the apps paint `<ion-icon name=…>`: without the registry it renders EMPTY offline
  // and under the CSP (ion-icon would try to fetch the SVG).
  addIcons(ION_ICONS);

  const i18n = createShellI18n({
    locale: options.session.value?.language ?? document.documentElement.lang,
    messages: options.messages,
  });
  const app = createApp(AppRoot);
  const session = provideSession(options.session, options.status, { app });
  const router = createShellRouter(options.routes, {
    session,
    loginPath: options.loginPath,
    history: options.history,
  });
  app.use(IonicVue, { mode: 'ios', swipeBackEnabled: false }).use(router).use(i18n);
  provideShellConfig({ homePath: options.homePath }, app);

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

  bootTheme();
  return { app, router };
}
