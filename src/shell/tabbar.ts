// Footer tabbar: the shared behaviour of an `ion-segment` used as the footer NAVIGATION bar, ported
// from OutfitKit's `src/tabbar/tabbar.ts` (origin/main; PLAN §16.11) — `theme/tabbar.css` already
// came from there. It fills a real gap of Ionic, it does not wrap it: `ion-segment` does not bring
// the checked tab into view, and whether the strip overflows and where its scroll is is exactly
// what CSS cannot know alone, so it is published in `data-overflow` and `tabbar.css` paints the fade.
//
// One call, keep the cleanup (AppPage does it for every footer strip):
//
//   const cleanup = bindTabbar(segment);
//   // on unmount → cleanup();

/** A tab of a page's footer strip (`<AppPage :tabs v-model:tab>`). */
export interface ShellTab {
  /** Stable id: the `v-model:tab` value and the `ion-segment-button` value. */
  id: string;
  /** Visible label, already translated. */
  label: string;
  /** `set:name` (`ion:receipt-outline`), painted with HubIcon: every tab has its icon. */
  icon: string;
  /** Route of the tab: then the route says which one is active and selecting one replaces the address. */
  to?: string;
  /** Sells something: not painted on the app surfaces (`surface.ts`). */
  webOnly?: boolean;
}

/** Which edges of the strip hide tabs. `none` = they all fit. */
export type TabbarOverflow = 'none' | 'start' | 'end' | 'both';

/** Sub-pixel slack: `scrollLeft` is fractional and never equals the maximum exactly. */
const EPSILON = 1;
/**
 * Width of the edge fade: the default of `--ep-tabbar-fade` in `tabbar.css` (a parity test ties
 * them). Revealing a tab one fade away from the edge keeps it out from under the gradient.
 */
export const FADE_PX = 36;
/** How far the strip peeks when it hints, and how long it takes to come back. */
const HINT_PX = 28;
const HINT_BACK_MS = 420;
/** The class `tabbar.css` styles. `bindTabbar` puts it on, so a consumer cannot forget it. */
const TABBAR_CLASS = 'tabbar';
/** Set while dragging, so the CSS changes the cursor and stops text selection. */
const DRAGGING_CLASS = 'tabbar-dragging';
/** How far the pointer must travel before it counts as a drag and not as a shaky click. */
const DRAG_THRESHOLD_PX = 4;

/**
 * Which edges hide tabs, so the fade is painted ONLY where there is more: a fixed fade on the right
 * would keep darkening the last tab once the end is reached, which reads as a painting bug.
 */
export function tabbarOverflow(segment: HTMLElement | null): TabbarOverflow {
  if (!segment) return 'none';
  const max = segment.scrollWidth - segment.clientWidth;
  if (max <= EPSILON) return 'none';
  const before = segment.scrollLeft > EPSILON;
  const after = segment.scrollLeft < max - EPSILON;
  if (before && after) return 'both';
  if (before) return 'start';
  return 'end';
}

/** Publishes the state in `data-overflow` so the fade is painted from CSS. */
export function syncTabbarOverflow(segment: HTMLElement | null): void {
  if (!segment) return;
  segment.dataset.overflow = tabbarOverflow(segment);
}

/**
 * Brings the checked tab into view. Needed when the ROUTE sets it (deep link, back/forward): the
 * strip mounts at `scrollLeft: 0` and the checked tab may be off screen. `scrollLeft` and not
 * `scrollIntoView`, so no scrollable ancestor is dragged along. One fade of margin: a tab flush with
 * the edge sits under the fade and reads as cut off; clamped, so at the ends the tab hugs the real
 * edge, where the fade switches itself off.
 */
export function scrollActiveTabIntoView(segment: HTMLElement | null): void {
  if (!segment) return;
  const active = segment.querySelector<HTMLElement>('.segment-button-checked');
  if (!active) return;
  const max = segment.scrollWidth - segment.clientWidth;
  if (max <= 0) return;

  const start = active.offsetLeft;
  const end = start + active.offsetWidth;
  const visibleStart = segment.scrollLeft;
  const visibleEnd = visibleStart + segment.clientWidth;
  const clamp = (v: number): number => Math.max(0, Math.min(v, max));
  if (start < visibleStart) segment.scrollLeft = clamp(start - FADE_PX);
  else if (end > visibleEnd) segment.scrollLeft = clamp(end - segment.clientWidth + FADE_PX);
}

/**
 * Is the scroll hint worth it on entry? The fade says there is more; the movement teaches the
 * GESTURE. It is movement nobody asked for, so only when it helps: something hidden to the right,
 * no reduced motion, and the strip did not just move by itself to reveal the checked tab.
 */
export function shouldHintScroll(opts: { overflow: TabbarOverflow; reducedMotion: boolean; alreadyScrolled: boolean }): boolean {
  if (opts.reducedMotion || opts.alreadyScrolled) return false;
  return opts.overflow === 'end' || opts.overflow === 'both';
}

/** Peeks the strip a few pixels and back: shows it slides. The REAL scroll, so the fade follows. */
export function hintScroll(segment: HTMLElement | null): void {
  if (!segment) return;
  segment.scrollTo({ left: HINT_PX, behavior: 'smooth' });
  setTimeout(() => segment.scrollTo({ left: 0, behavior: 'smooth' }), HINT_BACK_MS);
}

/**
 * Press-and-drag to scroll, for POINTING DEVICES ONLY: a finger already pans natively (with
 * momentum), and no browser turns a mouse drag into `scrollLeft`. A pen keeps the drag. The click
 * after a drag is swallowed, or releasing over another tab would navigate to it. The rest of the
 * gesture is watched on `window`: a ~48px strip loses a quick flick before the threshold.
 */
function bindDrag(segment: HTMLElement): () => void {
  let pointerId: number | null = null;
  let startX = 0;
  let startScroll = 0;
  let dragging = false;
  let swallowClick = false;
  let disarm: ReturnType<typeof setTimeout> | null = null;

  const onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startScroll = segment.scrollLeft;
    dragging = false;
    swallowClick = false;
  };

  /** Ends the gesture without arming the click swallow: nothing was released over a tab. */
  const endDrag = (): void => {
    if (dragging) {
      if (pointerId !== null) segment.releasePointerCapture?.(pointerId);
      segment.classList.remove(DRAGGING_CLASS);
    }
    pointerId = null;
    dragging = false;
  };

  const onMove = (e: PointerEvent): void => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    // The button is state: a release outside the window never reaches the page as a pointerup.
    if (e.buttons === 0) {
      endDrag();
      return;
    }
    const delta = e.clientX - startX;
    if (!dragging) {
      if (Math.abs(delta) < DRAG_THRESHOLD_PX) return;
      dragging = true;
      segment.classList.add(DRAGGING_CLASS);
      // Captured only past the threshold: earlier it would rob the tab of its hover and its click.
      segment.setPointerCapture?.(pointerId);
    }
    segment.scrollLeft = startScroll - delta;
  };

  const onUp = (e: PointerEvent): void => {
    if (pointerId === null || e.pointerId !== pointerId) return;
    if (dragging) {
      // Armed only for the click this gesture is about to produce; if it has not come by the next
      // task, it is not coming (a release outside produces none), and a keyboard Enter must pass.
      swallowClick = true;
      if (disarm !== null) clearTimeout(disarm);
      disarm = setTimeout(() => {
        swallowClick = false;
        disarm = null;
      }, 0);
    }
    endDrag();
  };

  // Capture phase: the tab is a descendant, so this runs before its own handler and can stop it.
  const onClick = (e: MouseEvent): void => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  };

  segment.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  segment.addEventListener('click', onClick, true);

  return () => {
    segment.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    segment.removeEventListener('click', onClick, true);
    if (disarm !== null) clearTimeout(disarm);
    segment.classList.remove(DRAGGING_CLASS);
  };
}

/**
 * Wires a footer strip and returns its cleanup. It watches three causes of change: `scroll` (the
 * person slides), a `ResizeObserver` (the width changes: rotating the phone, folding the menu) and
 * a `MutationObserver` (the NUMBER of tabs changes, or WHICH one is checked: the route sets it as
 * much as the finger). It reveals the checked tab on mount and whenever it changes (hub#1734), and
 * hints the scroll once on entry. `hint: false` turns the hint off (the fade stays).
 */
export function bindTabbar(segment: HTMLElement | null, opts: { hint?: boolean } = {}): () => void {
  if (!segment) return () => {};

  segment.classList.add(TABBAR_CLASS);
  const sync = (): void => syncTabbarOverflow(segment);

  // Reveal, then publish: the fade describes WHERE the strip is. And reveal only when the checked tab
  // CHANGES: Ionic marks every press with a class (`ion-activated`) and the drag adds its own, and
  // revealing on those yanked the strip back under the finger before the tap landed.
  let revealed: Element | null = null;
  const revealActive = (): void => {
    const active = segment.querySelector('.segment-button-checked');
    if (active !== revealed) {
      revealed = active;
      scrollActiveTabIntoView(segment);
    }
    sync();
  };

  revealActive();
  segment.addEventListener('scroll', sync, { passive: true });
  const unbindDrag = bindDrag(segment);

  const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null;
  resize?.observe(segment);
  // `attributeFilter: ['class']`: without it, the `data-overflow` that `sync` writes would feed this
  // observer its own writes.
  const tabs = typeof MutationObserver !== 'undefined' ? new MutationObserver(revealActive) : null;
  tabs?.observe(segment, { childList: true, subtree: true, attributeFilter: ['class'] });

  let hint: ReturnType<typeof setTimeout> | null = null;
  if (opts.hint !== false) {
    hint = setTimeout(() => {
      hint = null;
      const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (shouldHintScroll({ overflow: tabbarOverflow(segment), reducedMotion, alreadyScrolled: segment.scrollLeft > 1 })) {
        hintScroll(segment);
      }
    }, 450);
  }

  return () => {
    segment.removeEventListener('scroll', sync);
    unbindDrag();
    resize?.disconnect();
    tabs?.disconnect();
    if (hint) clearTimeout(hint);
  };
}
