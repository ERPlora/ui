// Focus helpers the components share (the form dialog, the assistant's panel).

/** What really has the focus: `document.activeElement` stops at a shadow host (an `ion-button` is
 *  focused on the native button inside it), so go down the shadow roots to the element itself.
 *  None when nothing has it (the body). */
export function focusedElement(): HTMLElement | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active instanceof HTMLElement && active !== document.body ? active : null;
}
