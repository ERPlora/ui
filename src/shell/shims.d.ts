// Type shims of the shell, also read by hub-next and saas-next (their tsconfig includes this file).
//
// Icons baked by `unplugin-icons` (`erploraVite()`, raw compiler, PLAN §16.4): `~icons/<set>/<name>`
// is the icon's SVG string, which `icons.ts` registers and `HubIcon` paints through `ion-icon`.
/// <reference types="unplugin-icons/types/raw" />

// `qrcode` as the SPA runs it: the browser build Vite bundles (the package's `browser` field). The
// sidebar's «Open on your phone» draws with it (SidebarInstallQr.vue). `@types/qrcode` would also type
// the Node build and pull Node's globals (`process`…) into every page of the projects that read this
// file, so only what the shell and the SaaS call is declared, as the SaaS's `frontend/qrcode.d.ts` does.
declare module 'qrcode' {
  namespace QRCode {
    type ErrorCorrectionLevel = 'low' | 'medium' | 'quartile' | 'high' | 'L' | 'M' | 'Q' | 'H';

    interface ToDataURLOptions {
      errorCorrectionLevel?: ErrorCorrectionLevel;
      /** Quiet zone around the code, in modules. */
      margin?: number;
      /** Pixels per module; `width` wins when both are given. */
      scale?: number;
      width?: number;
      color?: { dark?: string; light?: string };
      type?: 'image/png' | 'image/jpeg' | 'image/webp';
      rendererOpts?: { quality?: number };
    }

    /** The QR code of `text` as a `data:` URL of an image (PNG unless `type` says otherwise). */
    function toDataURL(text: string, options?: ToDataURLOptions): Promise<string>;
  }

  export = QRCode;
}
