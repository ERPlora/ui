// hub#1715 — the address the sidebar QR carries («Open on your phone», SidebarInstallQr.vue). A QR is
// only worth its place if ANOTHER device can act on what it reads, and a wrong address still paints a
// perfectly scannable code: the person only finds out with the phone in their hand. Hence a function
// with tests rather than an expression in the template.
import type QRCode from 'qrcode';

/** The slice of `window.location` this needs; the rest (`href`…) is ignored on purpose. */
export interface QrLocation {
  /** Scheme, host and port, as the browser reports them. */
  origin: string;
  href?: string;
}

/**
 * The hub on screen: its origin and nothing else (lowercase host, trailing slash). The path, the query
 * and the hash are dropped: the installed app sits on `/?shell=1`, which a phone has no business
 * receiving, and a code drawn on a screen deep in an app would open that screen, not the hub.
 */
export function installQrUrl(location: QrLocation): string {
  return new URL('/', location.origin).href;
}

/**
 * How the code is drawn: `M` correction survives a fingerprint on the screen without making the modules
 * too small for a phone camera; a quiet zone of two modules keeps it readable on the dark theme; drawn
 * at twice the 132 px it is painted at, so it stays sharp on a dense screen. `qrcode` fills its defaults
 * INTO the options it is handed, so every call takes a copy (`{ ...INSTALL_QR_OPTIONS }`).
 */
export const INSTALL_QR_OPTIONS: Readonly<QRCode.ToDataURLOptions> = {
  errorCorrectionLevel: 'M',
  margin: 2,
  width: 264,
};
