// The shell's icon registry (PLAN §16.4). Every icon is baked into the bundle at build time and
// nothing is fetched at runtime (CSP `connect-src` has no external hosts):
//   - Ionicons (`ion:`, the default set) come from `ionicons/icons`, each one already the
//     `data:image/svg+xml;utf8,<svg …>` URL that `ion-icon` parses inline. `createShell` registers
//     them with `addIcons(ION_ICONS)`, so a template's `ion-icon` with a `name` paints offline.
//   - The other Iconify sets (`lucide:`, `mdi:`, `material-symbols:`) come from `unplugin-icons`
//     (`~icons/<set>/<name>`, the SVG rendered from the installed `@iconify-json/*` by `erploraVite()`).
// Only what is listed here exists: an icon that is not registered paints NOTHING. The guardrail in
// `icons.test.ts` fails when a template, an `ionIconSrc`/`resolveIcon` call, an `icon:` key or a
// `*_ICONS` table names another one. Adding an icon is one import plus one entry. Paint them with
// `HubIcon` (any set) or `ion-icon` (Ionicons).
import {
  add,
  addOutline,
  alertCircle,
  alertCircleOutline,
  appsOutline,
  arrowBackOutline,
  backspaceOutline,
  calendarOutline,
  cardOutline,
  cart,
  cartOutline,
  cashOutline,
  chatbubblesOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  checkmarkOutline,
  chevronBack,
  chevronBackOutline,
  chevronDownOutline,
  chevronExpandOutline,
  chevronForward,
  chevronForwardOutline,
  chevronUpOutline,
  close,
  closeOutline,
  cloudOfflineOutline,
  cloudOutline,
  codeSlashOutline,
  contrastOutline,
  copyOutline,
  createOutline,
  cubeOutline,
  downloadOutline,
  ellipse,
  ellipsisVertical,
  fileTrayOutline,
  flaskOutline,
  funnel,
  globeOutline,
  gridOutline,
  helpCircleOutline,
  homeOutline,
  informationCircle,
  informationCircleOutline,
  keypadOutline,
  languageOutline,
  listOutline,
  lockClosedOutline,
  logInOutline,
  logOutOutline,
  logoGoogle,
  mailOutline,
  menuOutline,
  moonOutline,
  notificationsOutline,
  peopleOutline,
  personCircleOutline,
  personOutline,
  qrCodeOutline,
  receiptOutline,
  refreshOutline,
  searchOutline,
  settingsOutline,
  speedometerOutline,
  storefrontOutline,
  sunnyOutline,
  swapVerticalOutline,
  syncOutline,
  timeOutline,
  trashOutline,
  walletOutline,
  warning,
  warningOutline,
  wifiOutline,
} from 'ionicons/icons';
import lucideArrowLeft from '~icons/lucide/arrow-left';
import lucideCircleUser from '~icons/lucide/circle-user';
import lucideKeyRound from '~icons/lucide/key-round';
import lucideLock from '~icons/lucide/lock';
import lucidePanelLeft from '~icons/lucide/panel-left';
import lucideReceipt from '~icons/lucide/receipt';
import lucideRefreshCw from '~icons/lucide/refresh-cw';
import lucideShieldCheck from '~icons/lucide/shield-check';
import lucideShieldX from '~icons/lucide/shield-x';
import lucideShoppingBag from '~icons/lucide/shopping-bag';
import lucideSmartphone from '~icons/lucide/smartphone';
import lucideStore from '~icons/lucide/store';
import materialSymbolsPointOfSale from '~icons/material-symbols/point-of-sale';
import mdiCart from '~icons/mdi/cart';

/** The Ionicons of the shell and its apps, by their bare kebab-case name (what `addIcons` takes). */
export const ION_ICONS: Readonly<Record<string, string>> = Object.freeze({
  add,
  'add-outline': addOutline,
  'alert-circle': alertCircle,
  'alert-circle-outline': alertCircleOutline,
  'apps-outline': appsOutline,
  'arrow-back-outline': arrowBackOutline,
  'backspace-outline': backspaceOutline,
  'calendar-outline': calendarOutline,
  'card-outline': cardOutline,
  cart,
  'cart-outline': cartOutline,
  'cash-outline': cashOutline,
  'chatbubbles-outline': chatbubblesOutline,
  'checkmark-circle': checkmarkCircle,
  'checkmark-circle-outline': checkmarkCircleOutline,
  'checkmark-outline': checkmarkOutline,
  'chevron-back': chevronBack,
  'chevron-back-outline': chevronBackOutline,
  'chevron-down-outline': chevronDownOutline,
  'chevron-expand-outline': chevronExpandOutline,
  'chevron-forward': chevronForward,
  'chevron-forward-outline': chevronForwardOutline,
  'chevron-up-outline': chevronUpOutline,
  close,
  'close-outline': closeOutline,
  'cloud-offline-outline': cloudOfflineOutline,
  'cloud-outline': cloudOutline,
  'code-slash-outline': codeSlashOutline,
  'contrast-outline': contrastOutline,
  'copy-outline': copyOutline,
  'create-outline': createOutline,
  'cube-outline': cubeOutline,
  'download-outline': downloadOutline,
  ellipse,
  'ellipsis-vertical': ellipsisVertical,
  'file-tray-outline': fileTrayOutline,
  'flask-outline': flaskOutline,
  funnel,
  'globe-outline': globeOutline,
  'grid-outline': gridOutline,
  'help-circle-outline': helpCircleOutline,
  'home-outline': homeOutline,
  'information-circle': informationCircle,
  'information-circle-outline': informationCircleOutline,
  'keypad-outline': keypadOutline,
  'language-outline': languageOutline,
  'list-outline': listOutline,
  'lock-closed-outline': lockClosedOutline,
  'log-in-outline': logInOutline,
  'log-out-outline': logOutOutline,
  'logo-google': logoGoogle,
  'mail-outline': mailOutline,
  'menu-outline': menuOutline,
  'moon-outline': moonOutline,
  'notifications-outline': notificationsOutline,
  'people-outline': peopleOutline,
  'person-circle-outline': personCircleOutline,
  'person-outline': personOutline,
  'qr-code-outline': qrCodeOutline,
  'receipt-outline': receiptOutline,
  'refresh-outline': refreshOutline,
  'search-outline': searchOutline,
  'settings-outline': settingsOutline,
  'speedometer-outline': speedometerOutline,
  'storefront-outline': storefrontOutline,
  'sunny-outline': sunnyOutline,
  'swap-vertical-outline': swapVerticalOutline,
  'sync-outline': syncOutline,
  'time-outline': timeOutline,
  'trash-outline': trashOutline,
  'wallet-outline': walletOutline,
  warning,
  'warning-outline': warningOutline,
  'wifi-outline': wifiOutline,
});

/** `<svg …>` → the data URL format of ionicons' own icons, which `ion-icon` parses inline. */
const svgUrl = (svg: string): string => `data:image/svg+xml;utf8,${svg}`;

/** The icons of the other sets, by full `set:name`. */
const SET_ICONS: Readonly<Record<string, string>> = Object.freeze({
  'lucide:arrow-left': svgUrl(lucideArrowLeft),
  'lucide:circle-user': svgUrl(lucideCircleUser),
  'lucide:key-round': svgUrl(lucideKeyRound),
  'lucide:lock': svgUrl(lucideLock),
  'lucide:panel-left': svgUrl(lucidePanelLeft),
  'lucide:receipt': svgUrl(lucideReceipt),
  'lucide:refresh-cw': svgUrl(lucideRefreshCw),
  'lucide:shield-check': svgUrl(lucideShieldCheck),
  'lucide:shield-x': svgUrl(lucideShieldX),
  'lucide:shopping-bag': svgUrl(lucideShoppingBag),
  'lucide:smartphone': svgUrl(lucideSmartphone),
  'lucide:store': svgUrl(lucideStore),
  'material-symbols:point-of-sale': svgUrl(materialSymbolsPointOfSale),
  'mdi:cart': svgUrl(mdiCart),
});

const own = (table: Readonly<Record<string, string>>, key: string): string | undefined =>
  Object.hasOwn(table, key) ? table[key] : undefined;

/**
 * The data URL `ion-icon` paints for a registered icon: `set:name` of any set, or a bare Ionicons
 * name (read as `ion:`). `undefined` when it is not registered.
 */
export function resolveIcon(name: string): string | undefined {
  const at = name.indexOf(':');
  if (at === -1) return own(ION_ICONS, name);
  return name.startsWith('ion:') ? own(ION_ICONS, name.slice(4)) : own(SET_ICONS, name);
}

/**
 * Value for the `icon` PROPERTY of `ion-icon`, so a component paints an icon of any set offline:
 *   - inline SVG (`<svg …>`) → its data URL;
 *   - a registered icon      → its data URL (`resolveIcon`);
 *   - any other name         → as is: ion-icon looks it up in the `addIcons` registry.
 * The data URL is the one ionicons emits: `;utf8,` plus the RAW SVG, which ion-icon parses with
 * DOMParser instead of fetching it (percent-encoded, it cannot find the `<svg>` and paints nothing).
 */
export function ionIconSrc(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trimStart();
  if (trimmed.startsWith('<svg')) return svgUrl(trimmed);
  return resolveIcon(value) ?? value;
}
