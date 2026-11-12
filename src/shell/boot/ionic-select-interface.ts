// A single-choice `ion-select` opens a popover, which closes on the click of the option, instead of Ionic's default
// alert, which only commits the choice on OK. Ionic has no global config key for the default interface, so the shell
// sets it for every select, shadow roots included, by wrapping `open()`. A `multiple` select keeps the alert: choosing
// several things needs a confirm button. A programmatic `open()` with no event makes Ionic fall back to the alert.
import { patchIonicOnDefine } from './ionic-registry-hook';

/** The Ionic control whose default interface needs a confirm tap for a single choice. */
export const SELECT_INTERFACE_CONTROLS = ['ion-select'] as const;

/** Ionic's own default, assigned in the `ion-select` constructor. */
const IONIC_DEFAULT = 'alert';
const SINGLE_CHOICE = 'popover';

/** Marks a prototype we already patched, so a second boot is a no-op instead of a double wrap. */
const PATCHED = Symbol.for('erplora.ionic-select-interface.patched');

/** Per element, the interface the SHELL wrote last — anything else in there is the author's. */
const shellChoice = new WeakMap<SelectControl, string>();

type SelectControl = HTMLElement & {
  interface?: string;
  multiple?: boolean;
  open?: (ev?: Event) => Promise<unknown>;
};

/**
 * Points the element at the right interface for what it is about to open, unless its author chose. The one choice
 * that cannot be told apart is `.interface = 'alert'` written from JS, letter for letter Ionic's default.
 */
function applyDefaultInterface(el: SelectControl): void {
  if (el.hasAttribute('interface')) return; // chosen in markup, `alert` included
  const current = el.interface;
  const ours = shellChoice.get(el);
  if (current !== (ours ?? IONIC_DEFAULT)) return; // chosen from JS, before or after mounting

  const next = el.multiple ? IONIC_DEFAULT : SINGLE_CHOICE;
  shellChoice.set(el, next);
  if (current !== next) el.interface = next;
}

function patchConstructor(ctor: CustomElementConstructor): void {
  const proto = ctor.prototype as SelectControl & Record<symbol, unknown>;
  if (!proto || Object.prototype.hasOwnProperty.call(proto, PATCHED)) return;
  const original = proto.open;
  if (typeof original !== 'function') {
    // Not the `ion-select` this was written against: say so instead of guessing.
    console.error('[ionic-select-interface] the element has no `open()` to wrap.');
    return;
  }
  Object.defineProperty(proto, PATCHED, { value: true, enumerable: false });

  // Decided at `open()`, not at connect time: Stencil strips every own property of the element when it connects,
  // Ionic reads `interface` only when the dialog opens, and a module can toggle `multiple` on a mounted select.
  proto.open = function patchedOpen(this: SelectControl, ev?: Event): Promise<unknown> {
    try {
      applyDefaultInterface(this);
    } catch (error) {
      // The dialog must open no matter what: an alert that needs OK beats a select that is dead.
      console.error('[ionic-select-interface] choosing the interface failed; opening as is', error);
    }
    return original.call(this, anchoredTo(this, ev));
  };
}

type AnchorDetail = { ionShadowTarget?: EventTarget };

/**
 * The click, naming the select as the element its list opens against. The popover anchors to
 * `ev.detail?.ionShadowTarget || ev.target`, read after the click has left the module's shadow roots, when `target`
 * is already the module host, so the list would land on top of the module instead of the field. `Object.assign` skips
 * the getters of an `Event`, so what the popover also reads (`target`, the point) is carried over by hand.
 */
function anchoredTo(el: SelectControl, ev?: Event): Event | undefined {
  if (!ev) return ev;
  const { detail, clientX, clientY } = ev as Event & { detail?: unknown; clientX?: number; clientY?: number };
  if ((detail as AnchorDetail | undefined)?.ionShadowTarget) return ev;
  const extra = detail !== null && typeof detail === 'object' ? detail : {};
  return Object.assign({}, ev, {
    target: ev.target,
    clientX,
    clientY,
    detail: { ...extra, ionShadowTarget: el },
  });
}

/**
 * Unlike the other boot hooks, this one also works on a tag that is already registered: it wraps a method, not a
 * lifecycle callback.
 */
export function bootIonicSelectInterface(tags: readonly string[] = SELECT_INTERFACE_CONTROLS): void {
  const registered = patchIonicOnDefine(tags, patchConstructor);
  for (const tag of registered) {
    const ctor = globalThis.customElements?.get(tag);
    if (ctor) patchConstructor(ctor);
  }
}
