// The two places where happy-dom diverges from a browser on a path Ionic's runtime takes when one of
// its elements connects to the document (cases and reasons in `happyDom.test.ts`). Left open, every
// Ionic element a test attaches makes Stencil log a TypeError that buries the real failures. For a
// happy-dom test environment only: this package runs it from `vitest.setup.ts`; an app can too.

const FILLED = Symbol.for('erplora.ui.happy-dom-gaps');

type FillableSheet = CSSStyleSheet & { [FILLED]?: true };

/** Makes `CSSStyleSheet.replaceSync` and `document.dir` behave as in a browser. Idempotent; a no-op
 *  without a DOM. */
export function fillHappyDomGaps(): void {
  if (typeof document === 'undefined' || typeof CSSStyleSheet === 'undefined') return;
  const sheet = CSSStyleSheet.prototype as FillableSheet;
  if (!sheet[FILLED]) {
    // happy-dom's globals are per-window subclasses: the method is inherited, read it through them.
    const parse = Reflect.get(CSSStyleSheet.prototype, 'replaceSync') as (text: string) => void;
    // WebIDL: the argument is a USVString, so whatever arrives is converted to text first.
    Object.defineProperty(CSSStyleSheet.prototype, 'replaceSync', {
      configurable: true,
      writable: true,
      value(this: CSSStyleSheet, text: unknown): void {
        parse.call(this, String(text));
      },
    });
    Object.defineProperty(CSSStyleSheet.prototype, FILLED, { value: true });
  }
  // The global `Document` is not in the chain of happy-dom's `document`: its own class is patched.
  const documentClass = Object.getPrototypeOf(document) as Document;
  if (!('dir' in documentClass)) {
    // A browser reflects the `dir` attribute of <html> ('' when it has none).
    Object.defineProperty(documentClass, 'dir', {
      configurable: true,
      enumerable: true,
      get(this: Document): string {
        return this.documentElement?.getAttribute('dir') ?? '';
      },
      set(this: Document, value: unknown) {
        this.documentElement?.setAttribute('dir', String(value));
      },
    });
  }
}
