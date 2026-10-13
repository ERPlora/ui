// Public surface of the shell (V4 pieces + the V5 shell). The three `boot/*.boot.ts` side-effect
// modules come FIRST: an entry that imports this barrel must hook `customElements.define` before
// `./toast`, `./createShell` or the pages load `@ionic/vue`, which registers its elements on
// import (hub#1060). Guard: `index.test.ts`.
import './boot/ionic-fill.boot';
import './boot/ionic-select-text.boot';
import './boot/ionic-select-interface.boot';

export { patchIonicOnDefine } from './boot/ionic-registry-hook';
export type { CustomElementPatch } from './boot/ionic-registry-hook';
export { bootIonicFillMode, FILL_MODE_CONTROLS } from './boot/ionic-fill';
export { bootIonicSelectInterface, SELECT_INTERFACE_CONTROLS } from './boot/ionic-select-interface';
export {
  bootIonicSelectText,
  defaultSelectText,
  SELECT_TEXT_CONTROLS,
  setSelectTextTranslator,
} from './boot/ionic-select-text';
export type { SelectTextProp, SelectTextResolver } from './boot/ionic-select-text';
export { installTrustedTypesPolicy } from './boot/trusted-types.boot';
export { ION_ICONS, ionIconSrc, resolveIcon } from './icons';
export {
  applyUserThemePreferences,
  bootTheme,
  hasLocalPalette,
  isDark,
  resetUserThemePreferences,
  setHubPalette,
  setLocalPalette,
  setThemeMode,
  setThemePersister,
  THEME_PALETTES,
  themeMode,
  themePalette,
  toggleTheme,
} from './theme';
export type { ThemeMode, ThemePalette } from './theme';
export {
  dismissToast,
  toast,
  toastError,
  toastInfo,
  toastSuccess,
} from './toast';
export type { ToastAction, ToastColor } from './toast';
export { createShell } from './createShell';
export type { CreateShellOptions } from './createShell';
export { createAuthGate, createShellRouter, NOT_FOUND_ROUTE } from './router';
export type { ShellRouterOptions } from './router';
export { createShellSession, provideSession, SESSION_KEY, sessionReady, useSession } from './session';
export type {
  SessionApp,
  SessionMe,
  SessionMenuItem,
  SessionMenuSection,
  SessionStatus,
  SessionUser,
  ShellSession,
} from './session';
export { provideShellConfig, SHELL_CONFIG_KEY, useShellConfig } from './shell-config';
export type { ShellConfig } from './shell-config';
export { createShellI18n, SHELL_LOCALES, shellLocale } from './i18n';
export type { ShellI18n, ShellI18nOptions, ShellLocale } from './i18n';
export { default as AppPage } from './AppPage.vue';
export { default as AppTopbar } from './AppTopbar.vue';
export { default as HubIcon } from './HubIcon.vue';
