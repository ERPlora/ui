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
  chooseThemeMode,
  DEFAULT_THEME_CONTRAST,
  hasLocalPalette,
  isDark,
  resetUserThemePreferences,
  setHubPalette,
  setLocalPalette,
  setThemeContrast,
  setThemeMode,
  setThemePersister,
  THEME_CONTRASTS,
  THEME_PALETTES,
  themeContrast,
  themeMode,
  themePalette,
  toggleTheme,
} from './theme';
export type { ThemeContrast, ThemeMode, ThemePalette } from './theme';
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
export { createAuthGate, createShellRouter, HOME_ROUTE, NOT_FOUND_ROUTE, NOT_IN_APP_ROUTE, webOnlyGate } from './router';
export type { ShellRouterOptions } from './router';
export { createShellSession, logout, provideSession, SESSION_KEY, sessionReady, useSession } from './session';
export type {
  SessionApp,
  SessionMe,
  SessionMenuItem,
  SessionMenuSection,
  SessionStatus,
  SessionUser,
  ShellSession,
} from './session';
export {
  ANDROID_NOTIFICATIONS,
  askToNotify,
  bootNoticeTaps,
  createNoticeDoor,
  nativeBridge,
  NOT_THE_LINKED_HUB,
  PRIMER_ANSWERED_KEY,
  TOLD_KEY,
  useDeviceNotices,
} from './device-notices';
export type { AskToNotifyDeps, DeviceNotice, NativeBridge, NoticeDoor, NoticeDoorDeps } from './device-notices';
export { iconName, useMyApps } from './my-apps';
export { OPEN_EXTERNAL_COMMAND, openExternalLink } from './open-external';
export type { MyApp } from './my-apps';
export { provideShellConfig, SHELL_CONFIG_KEY, useShellConfig } from './shell-config';
export type { ShellChrome, ShellConfig } from './shell-config';
export type { ShellSidebar, ShellSidebarItem } from './sidebar';
export { applySurface, bootSurface, detectSurface, IN_APP_CLASS, isSurface, SURFACES, useSurface, vWebOnly } from './surface';
export type { Surface, SurfaceState, SurfaceWindow } from './surface';
export { bindTabbar, syncTabbarOverflow, tabbarOverflow } from './tabbar';
export type { ShellTab, TabbarOverflow } from './tabbar';
export { bindTabbarPeek } from './tabbar-peek';
export { provideUserMenu, USER_MENU_KEY, useUserMenu } from './user-menu';
export type { ShellUserMenu, ShellUserMenuItem } from './user-menu';
export { createShellI18n, SHELL_LOCALES, shellLocale } from './i18n';
export type { ShellI18n, ShellI18nOptions, ShellLocale } from './i18n';
export { default as AppPage } from './AppPage.vue';
export { default as AppTopbar } from './AppTopbar.vue';
export { default as HubIcon } from './HubIcon.vue';
export { default as WebOnly } from './WebOnly.vue';
