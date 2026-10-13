// outfitkit#182/#184 — Ionic 8's `ion-searchbar` renders its inner <input> with a constant
// `aria-label="search text"`, so screen readers announce «search text» instead of the visible hint.
// Stencil only rewrites that attribute when its vdom value changes (never: it is a constant), so
// setting it on the input survives re-renders. Call it after every render, so it follows a change
// of the hint and a searchbar created again.

type Searchbar = HTMLElement & { getInputElement?: () => Promise<HTMLInputElement> };

/** Names the inner input of the first `ion-searchbar` under `root` with `name()`, read when the
 *  input resolves (a later call may resolve first, and a stale value must not win). */
export function syncSearchbarInputName(root: ParentNode | null | undefined, name: () => string): void {
  const bar = root?.querySelector<Searchbar>('ion-searchbar');
  if (!bar) return;
  void customElements
    .whenDefined('ion-searchbar')
    .then(() => bar.getInputElement?.())
    .then((input) => {
      const text = name();
      if (input && input.getAttribute('aria-label') !== text) input.setAttribute('aria-label', text);
    })
    .catch((error: unknown) => {
      // A searchbar torn down while this was in flight has nothing left to name; one still on
      // screen keeps announcing «search text», and that is a defect to see.
      if (bar.isConnected) console.error('[DataTable] could not name the search box (outfitkit#182).', error);
    });
}
