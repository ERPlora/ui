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
// `sheet` says whether the open panel IS that sheet (below 834 px, following the breakpoint while it is
// open): then it covers the list and is modal (`aria-modal`, Tab kept inside by `trapTab`); from 834 px it
// sits beside the list and the focus may leave it.
import { onBeforeUnmount, type Ref, ref, watch } from 'vue';

const TOP = '--data-table-sheet-top';
const BOTTOM = '--data-table-sheet-bottom';
const SAFE = '--data-table-sheet-safe-bottom';
/** The stylesheet's sheet breakpoint (DataTable.vue `@media (max-width: 833.98px)`). */
const SHEET_QUERY = '(max-width: 833.98px)';
/** What can take the focus inside the sheet, Ionic's hosts included (their native control is in a shadow root). */
const FOCUSABLE = [
  'ion-button:not([disabled])',
  'ion-select:not([disabled])',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Focuses a control: an Ionic host through its native control. */
function focusInto(el: HTMLElement): void {
  (el.shadowRoot?.querySelector<HTMLElement>('button, input') ?? el).focus();
}

/** Keeps Tab inside `container` (a modal sheet): from its last control Tab goes to the first, from its
 *  first Shift+Tab goes to the last, and from anywhere else outside them to the first; in between the
 *  browser moves the focus. */
export function trapTab(container: HTMLElement, ev: KeyboardEvent): void {
  if (ev.key !== 'Tab') return;
  const controls = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
  if (!controls.length) return;
  const active = document.activeElement;
  const at = controls.findIndex((el) => el === active || el.contains(active) || !!el.shadowRoot?.contains(active));
  const first = controls[0];
  const last = controls[controls.length - 1];
  let next: HTMLElement | undefined;
  if (at === -1) next = ev.shiftKey ? last : first;
  else if (!ev.shiftKey && at === controls.length - 1) next = first;
  else if (ev.shiftKey && at === 0) next = last;
  if (!next) return;
  ev.preventDefault();
  focusInto(next);
}

type Edges = Pick<DOMRect, 'top' | 'bottom'>;

/** The content area inside the containing block, as distances from its top and bottom edges. */
export function sheetInsets(content: Edges, frame: Edges): { top: number; bottom: number } {
  return {
    top: Math.max(0, Math.round(content.top - frame.top)),
    bottom: Math.max(0, Math.round(frame.bottom - content.bottom)),
  };
}

/** Call from `setup`: `target` carries the offsets (the table's root), `open` says whether the panel is. */
export function useFilterSheet(target: () => HTMLElement | null, open: () => boolean): { sheet: Ref<boolean> } {
  const sheet = ref(false);
  let media: MediaQueryList | null = null;
  const onBreakpoint = (ev: { matches: boolean }) => {
    sheet.value = open() && ev.matches;
  };
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

  function follow(): void {
    media = typeof window.matchMedia === 'function' ? window.matchMedia(SHEET_QUERY) : null;
    sheet.value = !!media?.matches;
    media?.addEventListener('change', onBreakpoint);
  }

  function unfollow(): void {
    media?.removeEventListener('change', onBreakpoint);
    media = null;
    sheet.value = false;
  }

  watch(
    open,
    (now) => {
      if (now) {
        follow();
        measure();
      } else {
        unfollow();
        release();
      }
    },
    { flush: 'post' },
  );
  onBeforeUnmount(() => {
    unfollow();
    release();
  });
  return { sheet };
}
