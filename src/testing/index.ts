// `@erplora/ui/testing`: helpers for the tests of this package and of the apps (hub, saas). Node
// only (they read the disk): import them from tests, never from app code.
export { iconReferences, isRegisteredIcon, scanIcons } from './icons';
export type { IconKind, IconReference, ScanIconsOptions, ScanIconsResult, UnregisteredIcon } from './icons';
