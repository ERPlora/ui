// The ONE place where the shell imports OutfitKit components (`@erplora/outfitkit`, pinned at
// 0.1.136 in package.json). The package ships per-component entry points
// (`@erplora/outfitkit/ok-data-table`, ...; each one self-registers its tag through `define.js`),
// so we import only what the shell and the demo render, each in its own chunk. A page that needs
// another `ok-*` adds its tag here.
//
// Same contract as the ERPlora hub `main.ts`: side-effect imports, registered at boot, plus the
// `ion-*` dependencies the components render inside their shadow roots (see `./ionic-wc`).

const LOADERS: Record<string, () => Promise<unknown>> = {
  'ok-data-table': () => import('@erplora/outfitkit/ok-data-table'),
  'ok-inline-feedback': () => import('@erplora/outfitkit/ok-inline-feedback'),
  'ok-empty-state': () => import('@erplora/outfitkit/ok-empty-state'),
  'ok-status-pill': () => import('@erplora/outfitkit/ok-status-pill'),
  'ok-pinpad': () => import('@erplora/outfitkit/ok-pinpad'),
};

/** Tags registered by {@link registerOutfitkit}. */
export const OUTFITKIT_TAGS: readonly string[] = Object.keys(LOADERS);

/** In-flight or finished registration per tag, so concurrent calls share one import. */
const pending = new Map<string, Promise<unknown>>();

/** Registers the shell's OutfitKit components. Idempotent; skips tags that are already defined. */
export async function registerOutfitkit(): Promise<void> {
  await Promise.all(
    OUTFITKIT_TAGS.map((tag) => {
      if (customElements.get(tag)) return undefined;
      let load = pending.get(tag);
      if (!load) {
        load = LOADERS[tag]();
        pending.set(tag, load);
      }
      return load;
    }),
  );
}
