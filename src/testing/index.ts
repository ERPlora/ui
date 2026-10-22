// `@erplora/ui/testing`: helpers for the tests of this package and of the apps (hub, saas). Node
// only (they read the disk): import them from tests, never from app code.
export { bareIonIcons, unnamedButtons, unnamedIcons } from './a11y';
export { fillHappyDomGaps } from './happyDom';
export { iconReferences, isRegisteredIcon, scanIcons } from './icons';
export type { IconKind, IconReference, ScanIconsOptions, ScanIconsResult, UnregisteredIcon } from './icons';
