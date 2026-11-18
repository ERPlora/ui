import { inject, type InjectionKey } from 'vue';

/** The bar's «⋮» on a phone, as the pieces it lists see it. */
export interface TopbarMenu {
  /**
   * Closes the menu and runs `action` once it has gone. A panel opened while the menu plays its way out loses the
   * keyboard to the menu's focus trap, and what is typed in it lands on a row of the menu.
   */
  closeThen(action: () => void): void;
}

export const TOPBAR_MENU_KEY: InjectionKey<TopbarMenu> = Symbol('erplora.shell.topbar-menu');

/** The menu a piece of the bar is listed in, painted there as a row with its label; undefined in the bar itself. */
export function useTopbarMenu(): TopbarMenu | undefined {
  return inject(TOPBAR_MENU_KEY, undefined);
}
