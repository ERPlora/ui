// `@erplora/ui/testing`: helpers for the tests of this package and of the apps (hub, saas). Node
// only (they read the disk): import them from tests, never from app code.
export { bareIonIcons, unnamedButtons, unnamedIcons } from './a11y';
export { nameElementClasses } from './elementNames';
export { fillHappyDomGaps } from './happyDom';
export { iconReferences, isRegisteredIcon, registerShellIcons, scanIcons } from './icons';
export type { IconKind, IconReference, ScanIconsOptions, ScanIconsResult, UnregisteredIcon } from './icons';
export { MAIL_CODE, PASSWORD_RESET_LINK, readMailCode, readMails, readPasswordResetLink, waitForMail } from './mail';
export type { Mail, MailQuery } from './mail';
