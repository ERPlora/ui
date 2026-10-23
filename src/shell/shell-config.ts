// Static facts of the shell an app passes to `createShell`: where «Home» is (brand link of the
// menu, «Go to Home» of the 404), whether the shell's own Home (HomePage) is on, the hub's side
// menu (`sidebar`) and the project's pieces of the chrome (`chrome`). Plus the one gate of the
// authenticated chrome (`useChromeVisible`).
import { type App, type Component, computed, type ComputedRef, inject, type InjectionKey } from 'vue';
import { useRoute } from 'vue-router';

import { SESSION_KEY } from './session';
import type { ShellSidebar } from './sidebar';

export interface ShellConfig {
  /** Path of «Home». */
  homePath: string;
  /** The shell's Home is on (`createShell({ home: true })`, the hub): «Home» goes first in the menu. */
  home?: boolean;
  /**
   * The hub's side menu (sidebar.ts): the platform's entries instead of the session's menu, the QR in
   * its footer, the rail toggle and «My apps» in the topbar. Unset (the SaaS): the session's menu.
   */
  sidebar?: ShellSidebar;
  /** The project's pieces of the authenticated chrome; unset (the SaaS): none. */
  chrome?: ShellChrome;
}

/**
 * Components of the project that the shell mounts where the old hub had them (APP-BASE-1), only
 * behind the gate of the authenticated chrome (`useChromeVisible`). Each one reads its own data and
 * decides itself when to paint nothing.
 */
export interface ShellChrome {
  /** At the end of the topbar, after «My apps» (the hub's notification bell). */
  topbar?: Component;
  /** In the side menu's footer, between the QR and the brand (the hub's «Upgrade plan»). */
  sidebarFooter?: Component;
  /** Over the content of every screen, between the topbar and the scroller (the hub's blocking strip). */
  notice?: Component;
  /**
   * Mounted once beside the pane while a person is signed in, on every screen (its own frame included), and
   * again for the next person; it paints nothing of its own (the hub's device notices, APPOINTMENT-F28).
   */
  background?: Component;
}

const DEFAULTS: ShellConfig = { homePath: '/' };

export const SHELL_CONFIG_KEY: InjectionKey<ShellConfig> = Symbol('erplora.shell.config');

/** Provides the config app-wide (createShell). Missing or unset fields take the defaults. */
export function provideShellConfig(config: Partial<ShellConfig>, app: App): ShellConfig {
  const set = Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined));
  const full = Object.freeze({ ...DEFAULTS, ...set });
  app.provide(SHELL_CONFIG_KEY, full);
  return full;
}

/** The provided config, or the defaults. */
export function useShellConfig(): ShellConfig {
  return inject(SHELL_CONFIG_KEY, DEFAULTS);
}

/**
 * The one gate of the authenticated chrome (hub#925): the side menu, and the topbar's apps and rail
 * buttons. It exists where a session is REQUIRED (the route's `meta.auth`, the flag the auth gate
 * reads) and PRESENT; a screen that asks for credentials is outside it by construction, and so is one
 * that paints its own frame (`meta.chrome: false`). Without a session provided, it is simply off.
 */
export function useChromeVisible(): ComputedRef<boolean> {
  const session = inject(SESSION_KEY, null);
  const route = useRoute();
  return computed(
    () => (session?.user.value ?? null) !== null && route.meta.auth === true && route.meta.chrome !== false,
  );
}
