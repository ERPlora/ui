// Public surface of the shell package pieces ported in V4. The `boot/*.boot.ts` side-effect
// modules are NOT re-exported: the entry point imports them first, by path, so that their
// import-time hooks run before `@ionic/vue` registers its elements (hub#1060).
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
export { buildIconSvg, ICON_SETS, iconRegistry, resolveIcon, resolveIconAsync } from './icons';
export { ICON_CLASS, ICON_COLORS, ICON_CSS } from './icon-css';
export { OUTFITKIT_TAGS, registerOutfitkit } from './outfitkit';
export { IONIC_WC_TAGS, registerOutfitkitIonicDeps } from './ionic-wc';
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
  bootActionFeedback,
  dismissToast,
  toast,
  toastError,
  toastInfo,
  toastSuccess,
} from './toast';
export type { ToastAction, ToastColor } from './toast';
