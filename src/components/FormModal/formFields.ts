import { NON_FIELD_ERRORS } from './refusal';
import type { FormModalError } from './types';

/** The fields a page puts in the slot. Ionic's own say who they are on their host. */
export const FIELD_HOSTS = 'ion-input, ion-textarea, ion-select, ion-checkbox, ion-toggle, ion-radio-group, ion-range';
type FieldHost = Element & { name?: unknown; errorText?: unknown };

/** A native field's `name`, or an Ionic one's (it hands it to its native input). */
export function nameOf(el: Element): string | null {
  const name = (el as FieldHost).name;
  return typeof name === 'string' && name ? name : null;
}

/** What an Ionic field shows under it: Ionic Vue sets `error-text` as the element's property. */
export function shownMessageOf(el: Element): string | null {
  const shown = (el as FieldHost).errorText;
  return typeof shown === 'string' && shown ? shown : null;
}

/** Ionic hides a field's `error-text` unless the field is in this state. */
export const PAINTS_ITS_MESSAGE = '.ion-invalid.ion-touched';
/** Text that says nothing of a page's own: the banner, and the Ionic fields, which render their
 *  `error-text` even while they hide it. */
const NOT_WRITTEN_BY_THE_PAGE = `.ep-form-modal__error, ${FIELD_HOSTS}`;

/** The page wrote this reason itself under a field (`<small>{{ fieldErrors.customer }}</small>`). */
function writes(el: Element, reason: string): boolean {
  return [...el.childNodes].some((node) =>
    node instanceof Element
      ? !node.matches(NOT_WRITTEN_BY_THE_PAGE) && writes(node, reason)
      : node.nodeType === Node.TEXT_NODE && !!node.textContent?.includes(reason),
  );
}

/** Is this reason on screen, in a field painting it or written by the page? */
export function isSaid(root: Element, reason: string): boolean {
  const painted = [...root.querySelectorAll(FIELD_HOSTS)].some(
    (el) => el.matches(PAINTS_ITS_MESSAGE) && shownMessageOf(el) === reason,
  );
  return painted || writes(root, reason);
}

/** The refusal's message is also the reason of one of its fields (a name another record has), not the whole form's. */
export function repeatsAFieldReason(error: FormModalError | null | undefined): boolean {
  const message = error?.message;
  return Object.entries(error?.fields ?? {}).some(([name, reason]) => name !== NON_FIELD_ERRORS && reason === message);
}

/** That field says it under itself: a notice on top would only say it twice. */
export function saidUnderAField(root: Element, error: FormModalError | null | undefined): boolean {
  return !!error && repeatsAFieldReason(error) && isSaid(root, error.message);
}
