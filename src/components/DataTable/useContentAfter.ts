// With `fill`, the height of the table on a phone depends on whether content in flow follows it.
import { onBeforeUnmount, type Ref, ref, watch } from 'vue';

export interface ContentAfterSource {
  /** The table's root element (`.data-table`). */
  root: Ref<HTMLElement | null>;
  fill: () => boolean;
}

export function useContentAfter(source: ContentAfterSource, write: <V>(target: Ref<V>, value: V) => void) {
  const contentAfter = ref(false);
  let siblingsObserver: MutationObserver | undefined;

  /** Marks `contentAfter` while an element in flow follows the table in its parent. */
  function syncContentAfter(): void {
    let after = false;
    const root = source.root.value;
    if (source.fill() && root) {
      for (let el = root.nextElementSibling; el; el = el.nextElementSibling) {
        const style = getComputedStyle(el);
        if (style.display !== 'none' && style.position !== 'absolute' && style.position !== 'fixed') {
          after = true;
          break;
        }
      }
    }
    write(contentAfter, after);
  }

  /** Watches the parent: children added/removed and a sibling shown or hidden. */
  function observeSiblings(): void {
    siblingsObserver?.disconnect();
    siblingsObserver = undefined;
    const root = source.root.value;
    const parent = root?.parentNode;
    if (source.fill() && root && parent && typeof MutationObserver !== 'undefined') {
      siblingsObserver = new MutationObserver((records) => {
        if (records.some((r) => r.target === parent || (r.target !== root && r.target.parentNode === parent))) {
          syncContentAfter();
        }
      });
      siblingsObserver.observe(parent, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    }
    syncContentAfter();
  }
  watch(source.fill, observeSiblings, { flush: 'post' });
  onBeforeUnmount(() => siblingsObserver?.disconnect());

  return { contentAfter, syncContentAfter, observeSiblings };
}
