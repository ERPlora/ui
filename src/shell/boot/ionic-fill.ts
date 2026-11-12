// Ionic draws `fill` only in `md` mode (`@ionic/core`, input.js: `mode === 'md' && this.fill === 'outline'`), and the
// shell pins `mode: 'ios'`, so `fill="outline"` silently draws no box at all. The shell makes every control that asks
// for a `fill` render as Material, from a `customElements.define` wrapper: CSS cannot reach a module's shadow root,
// Ionic resolves the mode once in its own `connectedCallback` (too early for an observer), and the HTML spec captures
// the lifecycle callbacks inside `define`, so patching the prototype afterwards is never seen.

import { patchIonicOnDefine } from './ionic-registry-hook';

/** Ionic controls whose `fill` is a no-op outside `md`. `ion-button`/`ion-chip` honour it in `ios`. */
export const FILL_MODE_CONTROLS = ['ion-input', 'ion-select', 'ion-textarea'] as const;

/** Marks a prototype we already patched, so a second boot is a no-op instead of a double call. */
const PATCHED = Symbol.for('erplora.ionic-fill-mode.patched');

type IonicControl = HTMLElement & { fill?: string; mode?: string; connectedCallback?: () => void };

/**
 * A control that asks for a `fill` box and has not been told otherwise renders as Material, the
 * only mode where Ionic draws that box. Ionic reads `elm.mode || elm.getAttribute('mode')`, so
 * both spellings of an explicit mode are respected: this normalizes, it does not override.
 */
function normalizeFillMode(el: IonicControl): void {
  const wantsFill = el.fill != null || el.hasAttribute('fill');
  if (!wantsFill) return;
  if (el.mode != null || el.hasAttribute('mode')) return;
  el.setAttribute('mode', 'md');
}

function patchConstructor(ctor: CustomElementConstructor): void {
  const proto = ctor.prototype as IonicControl & Record<symbol, unknown>;
  if (!proto || Object.prototype.hasOwnProperty.call(proto, PATCHED)) return;
  Object.defineProperty(proto, PATCHED, { value: true, enumerable: false });

  const original = proto.connectedCallback;
  proto.connectedCallback = function patchedConnectedCallback(this: IonicControl): void {
    normalizeFillMode(this);
    original?.call(this);
  };
}

/**
 * Must run before anything registers those tags, that is, before `@ionic/vue` is even imported, which is why the
 * shell entry point imports `./ionic-fill.boot` first. Booting late cannot be fixed silently, so it is reported.
 */
export function bootIonicFillMode(tags: readonly string[] = FILL_MODE_CONTROLS): void {
  const tooLate = patchIonicOnDefine(tags, patchConstructor);
  if (tooLate.length > 0) {
    // Invisible by nature — the form simply renders without a box — so it has to be said out loud.
    console.error(
      `[ionic-fill] ${tooLate.join(', ')} was already registered when the shell tried to hook it: ` +
        'every `fill` on those controls will render with no box. Import ' +
        '`./ionic-fill.boot` before `@ionic/vue` in the shell entry point.',
    );
  }
}
