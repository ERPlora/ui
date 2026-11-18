// Ionic labels the two buttons of a select dialog from `cancelText`/`okText`, whose defaults are the English
// `'Cancel'` and `'OK'`, and has no global config key for them. So the shell writes the app's language into every
// select that did not label itself, modules included, right before each dialog opens: the language changes on the fly,
// and Stencil strips the element's own properties when it connects, so a value set then would never change again.
import { patchIonicOnDefine } from './ionic-registry-hook';

/** The Ionic controls whose default button labels are English literals. */
export const SELECT_TEXT_CONTROLS = ['ion-select'] as const;

/** The prop Ionic reads for each button, its attribute spelling, its English default and our key. */
const BUTTONS = [
  { prop: 'cancelText', attribute: 'cancel-text', ionic: 'Cancel', key: 'selectDialog.cancel' },
  { prop: 'okText', attribute: 'ok-text', ionic: 'OK', key: 'selectDialog.ok' },
] as const;

/** The two buttons of a selection dialog, by the prop name Ionic reads. */
export type SelectTextProp = (typeof BUTTONS)[number]['prop'];

/** Answers what a button should say RIGHT NOW — called every time a dialog opens. */
export type SelectTextResolver = (prop: SelectTextProp) => string;

/** Marks a prototype we already patched, so a second boot is a no-op instead of a double call. */
const PATCHED = Symbol.for('erplora.ionic-select-text.patched');
/** Reported once per button and boot: a dialog that falls back to English IS the bug this fixes. */
const reported = new Set<string>();

/** Says out loud that a button fell back to English — once, not on every dialog that opens. */
function report(key: string, ionic: string, error?: unknown): void {
  if (reported.has(key)) return;
  reported.add(key);
  console.error(
    `[ionic-select-text] \`${key}\` did not answer: the selection dialogs will show Ionic's ` +
      `English \`${ionic}\`.`,
    error ?? '',
  );
}

/** English defaults and the `es` map, used until the shell injects its i18n translator. */
const DEFAULT_TEXTS: Record<string, Record<SelectTextProp, string>> = {
  en: { cancelText: 'Cancel', okText: 'OK' },
  es: { cancelText: 'Cancelar', okText: 'Aceptar' },
};

/** Translator injected by the shell (vue-i18n `t`); `undefined` uses the built-in maps. */
let translator: ((key: string) => string) | undefined;

/** Wires the app's `t()` so the catalogue (key `selectDialog.cancel` / `selectDialog.ok`) wins. */
export function setSelectTextTranslator(t: ((key: string) => string) | undefined): void {
  translator = t;
}

/** Read at call time so the language active when the dialog opens always wins. */
export function defaultSelectText(prop: SelectTextProp): string {
  const { key } = BUTTONS.find((button) => button.prop === prop) ?? BUTTONS[0];
  if (translator) return translator(key);
  const lang = (document.documentElement.lang || 'en').toLowerCase().split('-')[0];
  return (DEFAULT_TEXTS[lang] ?? DEFAULT_TEXTS.en)[prop];
}

let resolve: SelectTextResolver = defaultSelectText;

/**
 * The text of a button, or Ionic's English default if the catalogue cannot answer.
 *
 * A dialog whose labels throw is a control the cashier cannot use, so the fallback is deliberate —
 * but it is the defect itself, so it is said out loud instead of silently shipping English.
 */
function textFor({ prop, ionic, key }: (typeof BUTTONS)[number]): string {
  try {
    const text = resolve(prop);
    if (typeof text === 'string' && text.length > 0 && text !== key) return text;
  } catch (error) {
    report(key, ionic, error);
    return ionic;
  }
  report(key, ionic);
  return ionic;
}

/** Per element, the labels the SHELL wrote last — anything else in there is the author's. */
const shellWrote = new WeakMap<SelectControl, Partial<Record<SelectTextProp, string>>>();

type SelectControl = HTMLElement &
  Partial<Record<SelectTextProp, string>> & { open?: (ev?: Event) => Promise<unknown> };

/**
 * Writes today's language into the buttons the element did not label itself.
 *
 * What counts as the author's choice: the `ok-text` / `cancel-text` attribute (even when it says
 * `OK`), and any value written from JS other than Ionic's default or what the shell wrote last —
 * so the shell localizes a DEFAULT and never overrides.
 */
function applyLocalizedDefaults(el: SelectControl): void {
  const wrote = shellWrote.get(el) ?? {};
  for (const button of BUTTONS) {
    const { prop, attribute, ionic } = button;
    if (el.hasAttribute(attribute)) continue; // labelled in markup
    const current = el[prop];
    if (current !== (wrote[prop] ?? ionic)) continue; // labelled from JS, before or after mounting

    const next = textFor(button);
    wrote[prop] = next;
    if (current !== next) el[prop] = next;
  }
  shellWrote.set(el, wrote);
}

function patchConstructor(ctor: CustomElementConstructor): void {
  const proto = ctor.prototype as SelectControl & Record<symbol, unknown>;
  if (!proto || Object.prototype.hasOwnProperty.call(proto, PATCHED)) return;
  const original = proto.open;
  if (typeof original !== 'function') {
    // Not the `ion-select` this was written against: say so instead of guessing.
    console.error('[ionic-select-text] the element has no `open()` to wrap.');
    return;
  }
  Object.defineProperty(proto, PATCHED, { value: true, enumerable: false });

  proto.open = function patchedOpen(this: SelectControl, ev?: Event): Promise<unknown> {
    try {
      applyLocalizedDefaults(this);
    } catch (error) {
      // The dialog must open no matter what: English buttons beat a select that is dead.
      console.error('[ionic-select-text] localizing the buttons failed; opening as is', error);
    }
    return original.call(this, ev);
  };
}

/**
 * Labels the buttons of every selection dialog, the Web Components of every module included, in the language active
 * when the dialog opens. It wraps a method, not a lifecycle callback, so it also works on a tag already registered.
 */
export function bootIonicSelectText(
  translate: SelectTextResolver = defaultSelectText,
  tags: readonly string[] = SELECT_TEXT_CONTROLS,
): void {
  resolve = translate;
  reported.clear(); // a new catalogue deserves a new chance to complain
  const registered = patchIonicOnDefine(tags, patchConstructor);
  for (const tag of registered) {
    const ctor = globalThis.customElements?.get(tag);
    if (ctor) patchConstructor(ctor);
  }
}
