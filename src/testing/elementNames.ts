// Ionic's element classes are anonymous (`class extends HTMLElement` in the minified build of
// @ionic/core), and Vitest prints an element as HTML only when its class has a name (the DOMElement
// printer of pretty-format). Unnamed, a failing assertion about an `ion-*` element is printed as a
// plain object, from its properties into `window`, and the run runs out of memory before it says
// what failed (ui#77). For tests only: this package runs it from `vitest.setup.ts`; an app can too,
// before anything registers an element.

const WRAPPED = Symbol.for('erplora.ui.named-element-classes');

type NamingRegistry = CustomElementRegistry & { [WRAPPED]?: true };

/** `ion-button` → `IonButtonElement`, as the DOM names its own classes (`HTMLButtonElement`). */
function classNameOf(tag: string): string {
  const words = tag.split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return `${words.join('')}Element`;
}

/** Gives every element class registered from now on without a name the one of its tag. Idempotent;
 *  a no-op without a DOM. */
export function nameElementClasses(): void {
  const registry = globalThis.customElements as NamingRegistry | undefined;
  if (!registry || registry[WRAPPED]) return;
  const define = registry.define.bind(registry);
  registry.define = (name: string, ctor: CustomElementConstructor, options?: ElementDefinitionOptions): void => {
    // A class's `name` is not writable, but it is configurable.
    if (!ctor.name) Object.defineProperty(ctor, 'name', { configurable: true, value: classNameOf(name) });
    define(name, ctor, options);
  };
  Object.defineProperty(registry, WRAPPED, { value: true });
}
