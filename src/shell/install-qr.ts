// The address the sidebar QR carries («Open on your phone»). A wrong address still paints a perfectly scannable
// code and the person only finds out with the phone in their hand, hence a tested function rather than an
// expression in the template.
import type QRCode from 'qrcode';

/** The slice of `window.location` this needs; the rest (`href`…) is ignored on purpose. */
export interface QrLocation {
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
