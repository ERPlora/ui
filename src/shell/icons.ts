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
  banOutline,
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
  closeCircleOutline,
  closeOutline,
  cloudOfflineOutline,
  cloudOutline,
  codeSlashOutline,
  contrastOutline,
  copyOutline,
  createOutline,
  cubeOutline,
  desktopOutline,
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
  keyOutline,
  keypadOutline,
  languageOutline,
  laptopOutline,
  listOutline,
  lockClosedOutline,
  logInOutline,
  logOutOutline,
  logoGoogle,
  mailOutline,
  mailUnreadOutline,
  menuOutline,
  moonOutline,
  notificationsOutline,
  peopleOutline,
  personAddOutline,
  personCircleOutline,
  personOutline,
  personRemoveOutline,
  phonePortraitOutline,
  qrCodeOutline,
  receiptOutline,
  refreshOutline,
  searchOutline,
  settingsOutline,
  shieldOutline,
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
import lucideCamera from '~icons/lucide/camera';
import lucideCircleUser from '~icons/lucide/circle-user';
import lucideCopy from '~icons/lucide/copy';
import lucideCreditCard from '~icons/lucide/credit-card';
import lucideEye from '~icons/lucide/eye';
import lucideHand from '~icons/lucide/hand';
import lucideKeyRound from '~icons/lucide/key-round';
import lucideLayers from '~icons/lucide/layers';
import lucideLayoutDashboard from '~icons/lucide/layout-dashboard';
import lucideLifeBuoy from '~icons/lucide/life-buoy';
import lucideLock from '~icons/lucide/lock';
import lucideMailOpen from '~icons/lucide/mail-open';
import lucideMonitorDown from '~icons/lucide/monitor-down';
import lucidePanelLeft from '~icons/lucide/panel-left';
import lucidePencil from '~icons/lucide/pencil';
import lucideReceipt from '~icons/lucide/receipt';
import lucideRefreshCw from '~icons/lucide/refresh-cw';
import lucideRotateCcw from '~icons/lucide/rotate-ccw';
import lucideSave from '~icons/lucide/save';
import lucideSend from '~icons/lucide/send';
import lucideShieldCheck from '~icons/lucide/shield-check';
import lucideShieldX from '~icons/lucide/shield-x';
import lucideShoppingBag from '~icons/lucide/shopping-bag';
import lucideSlidersHorizontal from '~icons/lucide/sliders-horizontal';
import lucideSmartphone from '~icons/lucide/smartphone';
import lucideSparkles from '~icons/lucide/sparkles';
import lucideStore from '~icons/lucide/store';
import lucideUnlink from '~icons/lucide/unlink';
import lucideUser from '~icons/lucide/user';
import lucideUserX from '~icons/lucide/user-x';
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
  'ban-outline': banOutline,
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
  'close-circle-outline': closeCircleOutline,
  'close-outline': closeOutline,
  'cloud-offline-outline': cloudOfflineOutline,
  'cloud-outline': cloudOutline,
  'code-slash-outline': codeSlashOutline,
  'contrast-outline': contrastOutline,
  'copy-outline': copyOutline,
  'create-outline': createOutline,
  'cube-outline': cubeOutline,
  'desktop-outline': desktopOutline,
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
  'key-outline': keyOutline,
  'keypad-outline': keypadOutline,
  'language-outline': languageOutline,
  'laptop-outline': laptopOutline,
  'list-outline': listOutline,
  'lock-closed-outline': lockClosedOutline,
  'log-in-outline': logInOutline,
  'log-out-outline': logOutOutline,
  'logo-google': logoGoogle,
  'mail-outline': mailOutline,
  'mail-unread-outline': mailUnreadOutline,
  'menu-outline': menuOutline,
  'moon-outline': moonOutline,
  'notifications-outline': notificationsOutline,
  'people-outline': peopleOutline,
  'person-add-outline': personAddOutline,
  'person-circle-outline': personCircleOutline,
  'person-outline': personOutline,
  'person-remove-outline': personRemoveOutline,
  'phone-portrait-outline': phonePortraitOutline,
  'qr-code-outline': qrCodeOutline,
  'receipt-outline': receiptOutline,
  'refresh-outline': refreshOutline,
  'search-outline': searchOutline,
  'settings-outline': settingsOutline,
  'shield-outline': shieldOutline,
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
  'lucide:camera': svgUrl(lucideCamera),
  'lucide:circle-user': svgUrl(lucideCircleUser),
  'lucide:copy': svgUrl(lucideCopy),
  'lucide:credit-card': svgUrl(lucideCreditCard),
  'lucide:eye': svgUrl(lucideEye),
  'lucide:hand': svgUrl(lucideHand),
  'lucide:key-round': svgUrl(lucideKeyRound),
  'lucide:layers': svgUrl(lucideLayers),
  'lucide:layout-dashboard': svgUrl(lucideLayoutDashboard),
  'lucide:life-buoy': svgUrl(lucideLifeBuoy),
  'lucide:lock': svgUrl(lucideLock),
  'lucide:mail-open': svgUrl(lucideMailOpen),
  'lucide:monitor-down': svgUrl(lucideMonitorDown),
  'lucide:panel-left': svgUrl(lucidePanelLeft),
  'lucide:pencil': svgUrl(lucidePencil),
  'lucide:receipt': svgUrl(lucideReceipt),
  'lucide:refresh-cw': svgUrl(lucideRefreshCw),
  'lucide:rotate-ccw': svgUrl(lucideRotateCcw),
  'lucide:save': svgUrl(lucideSave),
  'lucide:send': svgUrl(lucideSend),
  'lucide:shield-check': svgUrl(lucideShieldCheck),
  'lucide:shield-x': svgUrl(lucideShieldX),
  'lucide:shopping-bag': svgUrl(lucideShoppingBag),
  'lucide:sliders-horizontal': svgUrl(lucideSlidersHorizontal),
  'lucide:smartphone': svgUrl(lucideSmartphone),
  'lucide:sparkles': svgUrl(lucideSparkles),
  'lucide:store': svgUrl(lucideStore),
  'lucide:unlink': svgUrl(lucideUnlink),
  'lucide:user': svgUrl(lucideUser),
  'lucide:user-x': svgUrl(lucideUserX),
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
