// The user menu (App.vue): the person at the top of the side menu opens an ion-popover with the
// project's entries, Help, the theme (light, dark, system) and Sign out (mockups README §3; PLAN-SAAS
// §3.6, point 1). The theme is the shell's; the rest is what the project hands to
// `createShell({ userMenu })`: an entry the project cannot honour (no help page, no way to sign out)
// is simply not offered.
import { type App, inject, type InjectionKey } from 'vue';

export interface ShellUserMenuItem {
  /** Stable id (`data-testid="user-menu-<id>"`). */
  id: string;
  /** i18n key of its label, in the catalogues merged by `createShell({ messages })`. */
  labelKey: string;
  /** `set:name`, painted with HubIcon. */
  icon: string;
  /** Route it opens. */
  to: string;
  /** Sells something: not offered on the app surfaces (`surface.ts`). */
  webOnly?: boolean;
}

export interface ShellUserMenu {
  /** The project's entries, first (the SaaS: «Account»). */
  items?: ShellUserMenuItem[];
  /** Route of «Help»; without it there is no Help entry. */
  helpPath?: string;
  /**
   * «Sign out»: what the project does to end the session (the SaaS: allauth's DELETE of the session,
   * then the login). Without it there is no Sign out entry. A rejection is shown as an error toast.
   */
  logout?: () => void | Promise<void>;
}

export const USER_MENU_KEY: InjectionKey<ShellUserMenu> = Symbol('erplora.shell.userMenu');

const NONE: ShellUserMenu = Object.freeze({});

/** Provides the user menu app-wide (createShell). */
export function provideUserMenu(menu: ShellUserMenu | undefined, app: App): ShellUserMenu {
  const config = Object.freeze({ ...(menu ?? NONE) });
  app.provide(USER_MENU_KEY, config);
  return config;
}

/** The provided user menu, or none (only the theme). */
export function useUserMenu(): ShellUserMenu {
  return inject(USER_MENU_KEY, NONE);
}
