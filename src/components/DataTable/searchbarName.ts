// outfitkit#182/#184 — Ionic 8's `ion-searchbar` renders its inner <input> with a constant
// `aria-label="search text"`, so screen readers announce «search text» instead of the visible hint.
// Its clear button is another constant of the same render, `aria-label="reset"`, in English whatever
// the person's language (FIX-UI-SEARCHBAR-CLEAR-BUTTON-SAYS-RESET). Stencil only rewrites an attribute
// when its vdom value changes (never: they are constants), so setting them survives re-renders. Call it
// after every render, so it follows a change of the hint or the language and a searchbar created again.
import { pageLabel } from './labels';

type Searchbar = HTMLElement & { getInputElement?: () => Promise<HTMLInputElement> };

/** Names the inner input of the first `ion-searchbar` under `root` with `name()`, and its clear button
 *  with `clearName()` (by default «Clear search» in the language of the page), both read when the input
 *  resolves (a later call may resolve first, and a stale value must not win). */
export function syncSearchbarInputName(
  root: ParentNode | null | undefined,
  name: () => string,
  clearName: () => string = () => pageLabel('clearSearch'),
): void {
  const bar = root?.querySelector<Searchbar>('ion-searchbar');
  if (!bar) return;
  void customElements
    .whenDefined('ion-searchbar')
    .then(() => bar.getInputElement?.())
    .then((input) => {
      nameElement(input, name());
      nameElement(bar.querySelector('button.searchbar-clear-button'), clearName());
    })
    .catch((error: unknown) => {
      // A searchbar torn down while this was in flight has nothing left to name; one still on
      // screen keeps announcing «search text», and that is a defect to see.
      if (bar.isConnected) console.error('[DataTable] could not name the search box (outfitkit#182).', error);
    });
}

function nameElement(element: Element | null | undefined, text: string): void {
  if (element && element.getAttribute('aria-label') !== text) element.setAttribute('aria-label', text);
}
