// Where the filters sheet starts and ends below 834 px (outfitkit#75/#197). There the filters panel is a
// sheet over the content area, strictly between the app's header and its tab bar: `position: fixed`
// with `inset: 0` painted it from the top of the page to the screen edge, so the header covered its
// title and its Close button, and the tab bar (an `ion-footer` OUTSIDE `ion-content`) covered its last
// 66 px (ios) / 72 px (md), «Apply» included. CSS cannot know where the content area is, so while the
// sheet is open the table measures the closest `ion-content` against the sheet's containing block (the
// `ion-page`: `contain: layout`; the window without one) and publishes both offsets on its root:
//   --data-table-sheet-top / --data-table-sheet-bottom  where the sheet begins and ends;
//   --data-table-sheet-safe-bottom: 0px                 a tab bar is below and already keeps the
//                                                         safe area (unset: DataTable's default, the
//                                                         device's safe area, kept by the sheet's footer).
// It measures again on every resize of the content (rotation, a tab bar mounted late) and of the
// window; on close (and unmount) the offsets go and nothing is observed any more.
import { onBeforeUnmount, watch } from 'vue';

const TOP = '--data-table-sheet-top';
const BOTTOM = '--data-table-sheet-bottom';
const SAFE = '--data-table-sheet-safe-bottom';

type Edges = Pick<DOMRect, 'top' | 'bottom'>;

/** The content area inside the containing block, as distances from its top and bottom edges. */
export function sheetInsets(content: Edges, frame: Edges): { top: number; bottom: number } {
  return {
    top: Math.max(0, Math.round(content.top - frame.top)),
    bottom: Math.max(0, Math.round(frame.bottom - content.bottom)),
  };
}

/** Call from `setup`: `target` carries the offsets (the table's root), `open` says whether the sheet is. */
export function useFilterSheet(target: () => HTMLElement | null, open: () => boolean): void {
  let observer: ResizeObserver | null = null;
  let observed: Element | null = null;
  let listening = false;

  function measure(): void {
    const el = target();
    if (!el || !open()) return;
    const content = el.closest('ion-content');
    const frame: Edges = el.closest('.ion-page')?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight };
    const { top, bottom } = content ? sheetInsets(content.getBoundingClientRect(), frame) : { top: 0, bottom: 0 };
    el.style.setProperty(TOP, `${top}px`);
    el.style.setProperty(BOTTOM, `${bottom}px`);
    if (bottom > 0) el.style.setProperty(SAFE, '0px');
    else el.style.removeProperty(SAFE);
    // observe() delivers one notification of its own: observing the same box again on every measure
    // would measure in a loop for as long as the sheet stays open.
    if (typeof ResizeObserver !== 'undefined' && content !== observed) {
      observer ??= new ResizeObserver(measure);
      observer.disconnect();
      if (content) observer.observe(content);
      observed = content;
    }
    if (!listening) {
      window.addEventListener('resize', measure);
      listening = true;
    }
  }

  function release(): void {
    const el = target();
    el?.style.removeProperty(TOP);
    el?.style.removeProperty(BOTTOM);
    el?.style.removeProperty(SAFE);
    observer?.disconnect();
    observed = null;
    if (listening) window.removeEventListener('resize', measure);
    listening = false;
  }

  watch(open, (now) => (now ? measure() : release()), { flush: 'post' });
  onBeforeUnmount(release);
}
