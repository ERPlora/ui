// The accessible-name guardrail (UX audit 2, R-03), shared by this package and the apps that use it:
// what axe's `role-img-alt` and `button-name` rules check, on a DOM happy-dom can build (it lays
// nothing out and runs no Ionic, so the rules are read on the elements and attributes we render).
// Ionic paints every `ion-icon` as `role="img"`: an icon is either decorative (`aria-hidden="true"`,
// next to a text or inside a button named by its own `aria-label`) or named (`HubIcon`'s `label`).
//   - `unnamedIcons` / `unnamedButtons`: on a rendered tree (a mounted component);
//   - `bareIonIcons`: on a source, the static twin for a whole tree of templates.

/** Hidden from assistive tech by itself or an ancestor. */
const HIDDEN = '[aria-hidden="true"], [inert]';
/** What a screen reader announces as a button. */
const BUTTONS = 'button, ion-button, ion-segment-button, ion-menu-button, ion-back-button, [role="button"]';

const hidden = (el: Element): boolean => el.closest(HIDDEN) !== null;

/** `aria-label` (not blank) or `aria-labelledby`: a name of its own. */
const named = (el: Element): boolean =>
  !!el.getAttribute('aria-label')?.trim() || !!el.getAttribute('aria-labelledby')?.trim();

/** Named on the host, or on the native button where hydrated Ionic moves the host's `aria-label`. */
const ownName = (el: Element): boolean => {
  const native = el.shadowRoot?.querySelector('button, a');
  return named(el) || (!!native && named(native));
};

/** The text a screen reader reads inside `el`: what its hidden parts say does not count. */
function readableText(el: Element): string {
  let text = '';
  for (const node of el.childNodes) {
    if (node.nodeType === 3) text += node.textContent ?? '';
    else if (node.nodeType === 1 && !(node as Element).matches(HIDDEN)) text += readableText(node as Element);
  }
  return text.trim();
}

/** Every `ion-icon` under `root` that assistive tech reaches (not hidden) without a name. */
export function unnamedIcons(root: ParentNode): Element[] {
  return [...root.querySelectorAll('ion-icon')].filter((icon) => !hidden(icon) && !ownName(icon));
}

/** Every button under `root` that assistive tech reaches without a name: no `aria-label`,
 *  `aria-labelledby` or `title`, and no readable text (an icon alone names nothing). */
export function unnamedButtons(root: ParentNode): Element[] {
  return [...root.querySelectorAll(BUTTONS)].filter(
    (button) => !hidden(button) && !ownName(button) && !button.getAttribute('title')?.trim() && !readableText(button),
  );
}

/** One attribute of a tag with its whole value: a `>` inside `@click="() => a > b"` does not end it. */
const ATTR = String.raw`\s+[^\s=>/"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?`;
const ION_ICON_TAG = new RegExp(String.raw`<(?:ion-icon|IonIcon)\b(?:${ATTR})*\s*/?>`, 'g');
/** Hidden or named, written or bound (`:aria-hidden`), or spread by `v-bind="…"` (HubIcon). */
const A11Y_ATTR = /\s(?::|v-bind:)?(?:aria-hidden|aria-label|aria-labelledby)\b|\sv-bind\s*=/;

/** The `<ion-icon …>` tags of a template source with neither `aria-hidden` nor a name. */
export function bareIonIcons(source: string): string[] {
  return [...source.matchAll(ION_ICON_TAG)].map(([tag]) => tag).filter((tag) => !A11Y_ATTR.test(tag));
}
