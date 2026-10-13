// Shared by the Ionic boot hooks (`ionic-fill`, `ionic-select-interface`, `ionic-select-text`).
// Ported from ERPlora hub `apps/web/src/lib/ionic-registry-hook.ts`.

/** Runs on the element class the instant before it is registered, never after. */
export type CustomElementPatch = (ctor: CustomElementConstructor) => void;

/** Holds, on the registry, the patches to apply per tag. */
const PATCHES = Symbol.for('erplora.ionic-registry.patches');
/** Marks the registry whose `define` we already wrapped. */
const WRAPPED = Symbol.for('erplora.ionic-registry.wrapped');

type PatchesByTag = Map<string, CustomElementPatch[]>;

/**
 * Applies `patch` to `tags` the moment each of them is registered.
 *
 * Returns the tags that were **already** registered when this was called: for those the patch can
 * no longer be installed, and the failure is invisible by nature (the control simply renders
 * wrong), so every caller reports it. Ordering is the whole fix: this has to run before
 * `@ionic/vue` is imported, which is why the callers are side-effect `*.boot` modules imported at
 * the very top of the entry point.
 */
export function patchIonicOnDefine(
  tags: readonly string[],
  patch: CustomElementPatch,
): readonly string[] {
  const registry = globalThis.customElements;
  if (!registry) return []; // SSR / unit tests without a DOM: nothing to hook.

  const patches = ((registry as unknown as Record<symbol, PatchesByTag>)[PATCHES] ??= new Map());
  for (const tag of tags) {
    const forTag = patches.get(tag) ?? [];
    if (!forTag.includes(patch)) forTag.push(patch);
    patches.set(tag, forTag);
  }

  if (!Object.prototype.hasOwnProperty.call(registry, WRAPPED)) {
    Object.defineProperty(registry, WRAPPED, { value: true, enumerable: false });
    const original = registry.define.bind(registry);
    registry.define = (
      name: string,
      ctor: CustomElementConstructor,
      options?: ElementDefinitionOptions,
    ) => {
      for (const apply of patches.get(name) ?? []) {
        try {
          apply(ctor);
        } catch (error) {
          console.error(`[ionic-registry] patching <${name}> failed; registering it unpatched`, error);
        }
      }
      return original(name, ctor, options);
    };
  }

  return tags.filter((tag) => registry.get(tag));
}
