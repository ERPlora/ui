// The other Iconify sets (`lucide:`, `mdi:`, `material-symbols:`) come from `unplugin-icons`
// (`~icons/<set>/<name>`, the SVG rendered from the installed `@iconify-json/*` by `erploraVite()`), baked at build
// time like the Ionicons of `icons.ts`, whose `resolveIcon` looks them up by their full `set:name`.
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
import lucideMailCheck from '~icons/lucide/mail-check';
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

/** `<svg …>` → the data URL format of ionicons' own icons, which `ion-icon` parses inline. */
export const svgUrl = (svg: string): string => `data:image/svg+xml;utf8,${svg}`;

/** The icons of the other sets, by full `set:name`. */
export const SET_ICONS: Readonly<Record<string, string>> = Object.freeze({
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
  'lucide:mail-check': svgUrl(lucideMailCheck),
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
