// Type shims for deep imports that ship no declarations: per-component entry points of OutfitKit
// (side-effect imports that self-register their tag) and `@ionic/core/components/*` definers.
declare module '@erplora/outfitkit/ok-*';
declare module '@ionic/core/components/*.js' {
  export const defineCustomElement: () => void;
}
