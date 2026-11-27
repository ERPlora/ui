// A tab's icon and label are centred, so a cut that leaves a narrow sliver of the next tab puts the edge fade on empty
// background, and the strip reads as one that ends there. As Material's scrollable tabs and Apple's tab bars do, the
// next tab is left peeking, cut through its own content: the tab width that makes the cut fall past the centre of the
// first hidden tab is published in `--ep-tabbar-min`.
import { FADE_PX, syncTabbarOverflow } from './tabbar';

/** The token `tabbar.css` reads for the narrowest a tab may be before the strip scrolls. */
const PEEK_PROPERTY = '--ep-tabbar-min';

/**
 * How far PAST the first hidden tab's centre the cut has to fall: half of the 24px footer icon, so
 * the whole leading half of the tab is on screen, where the fade dims it instead of erasing it.
 */
const PEEK_MARGIN_PX = 12;

/** Sub-pixel slack: `scrollWidth` and `clientWidth` are rounded differently by the engine. */
const EPSILON = 1;

/** What a footer tab strip looks like right now, in the strip's own `offsetLeft` coordinates. */
export interface TabbarGeometry {
  /** `clientWidth`: how much of the strip the person can see. */
  visibleWidth: number;
  /** `scrollWidth`: how much the tabs really need. */
  contentWidth: number;
  /** `offsetLeft` of the first tab — the strip's leading padding. */
  firstTabLeft: number;
  /** `offsetWidth` of the widest tab: the one every tab takes once the strip scrolls. */
  tabWidth: number;
  /** Distance between the left edges of two consecutive tabs: `tabWidth` plus the gap. */
  tabPitch: number;
  /** How many tabs the strip holds. */
  tabCount: number;
}

/** Index of the first tab the cut leaves incomplete, or `null` when every tab fits. */
function firstHiddenTab(geometry: TabbarGeometry): number | null {
  for (let index = 0; index < geometry.tabCount; index += 1) {
    const right = geometry.firstTabLeft + index * geometry.tabPitch + geometry.tabWidth;
    if (right > geometry.visibleWidth) return index;
  }
  return null;
}

/**
 * Is the strip hiding tabs without showing it? True when the cut falls SHORT of the first hidden
 * tab's centre: the sliver on screen is padding, so there is nothing for the fade to fade.
 */
export function hidesTabsSilently(geometry: TabbarGeometry): boolean {
  if (geometry.contentWidth <= geometry.visibleWidth + EPSILON) return false;
  const hidden = firstHiddenTab(geometry);
  if (hidden === null) return false;
  const centre = geometry.firstTabLeft + hidden * geometry.tabPitch + geometry.tabWidth / 2;
  return centre > geometry.visibleWidth;
}

/**
 * The tab width that leaves the first hidden tab peeking, or `null` when there is nothing to say.
 * Solves, for a strip that shows `whole` complete tabs and then the cut,
 *
 *     firstTabLeft + whole · (width + gap) + width / 2 = visibleWidth − PEEK_MARGIN_PX
 *
 * and takes the largest `whole` whose answer still respects the width the tabs already had (the
 * floor: 56px in `tabbar.css`). When not even one whole tab and the peek fit at the
 * floor, the floor stands and there is no peek: a squeezed label is worse.
 */
export function peekTabWidth(geometry: TabbarGeometry): number | null {
  if (geometry.contentWidth <= geometry.visibleWidth + EPSILON) return null;
  if (geometry.tabCount < 2) return null;

  const gap = geometry.tabPitch - geometry.tabWidth;
  const room = geometry.visibleWidth - PEEK_MARGIN_PX - geometry.firstTabLeft;
  const widthFor = (whole: number): number => (room - whole * gap) / (whole + 0.5);

  let chosen: number | null = null;
  for (let whole = geometry.tabCount - 1; whole >= 1; whole -= 1) {
    if (widthFor(whole) >= geometry.tabWidth) {
      chosen = whole;
      break;
    }
  }
  if (chosen === null) return geometry.tabWidth;

  // Rounded DOWN: a narrower tab moves the cut further past the centre, never short of it.
  const width = Math.floor(widthFor(chosen) * 100) / 100;
  return Number.isFinite(width) && width > 0 ? width : null;
}

/**
 * Scrolls the strip the least it takes to show its selected tab whole and one fade clear of each
 * edge that still hides tabs. The engine clamps the scroll to the strip, so
 * the last tab takes it to its end, where no fade is painted.
 */
function keepSelectedTabInView(segment: HTMLElement): void {
  const selected = segment.querySelector<HTMLElement>('ion-segment-button.segment-button-checked');
  if (!selected) return;
  const tabStart = selected.offsetLeft;
  const tabEnd = tabStart + selected.offsetWidth;
  let target = segment.scrollLeft;
  if (tabEnd > target + segment.clientWidth - FADE_PX) target = tabEnd - segment.clientWidth + FADE_PX;
  // The leading edge wins when the tab is too wide for both: its label starts there.
  if (tabStart < target + FADE_PX) target = tabStart - FADE_PX;
  segment.scrollLeft = target;
}

/**
 * Reads the live geometry of a strip. `null` when there is not enough of it to measure a pitch. A tab
 * with a long word is wider than the rest (`tabbar.css`), so the width is the WIDEST tab's: published as
 * the floor, it makes every tab that wide again and the peek lands where it was computed.
 */
function readTabbarGeometry(segment: HTMLElement): TabbarGeometry | null {
  const tabs = Array.from(segment.querySelectorAll<HTMLElement>('ion-segment-button'));
  const first = tabs[0];
  const second = tabs[1];
  if (!first || !second) return null;
  const tabWidth = Math.max(...tabs.map((tab) => tab.offsetWidth));
  const gap = second.offsetLeft - first.offsetLeft - first.offsetWidth;
  return {
    visibleWidth: segment.clientWidth,
    contentWidth: segment.scrollWidth,
    firstTabLeft: first.offsetLeft,
    tabWidth,
    tabPitch: tabWidth + gap,
    tabCount: tabs.length,
  };
}

/**
 * Keeps a strip's tabs sized so the overflow stays visible. Returns its cleanup. Recomputes when the
 * strip changes width, when a label changes size and when the number of tabs changes. Every pass
 * first drops the width it published last time: the floor is the one the STYLESHEET declares, or it
 * would ratchet up on every rotation of the phone. Keeping each word whole is `tabbar.css`'s job: a
 * column never narrows below its longest word.
 */
export function bindTabbarPeek(segment: HTMLElement | null): () => void {
  if (!segment) return () => {};

  // A resize is answered on the next frame, not inside the observer: `apply` resizes the labels it
  // watches, and doing that inside the callback is a ResizeObserver loop.
  let frame = 0;
  const applyNextFrame = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      apply();
    });
  };
  const resize = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(applyNextFrame) : null;

  const apply = (): void => {
    const published = segment.style.getPropertyValue(PEEK_PROPERTY);
    const scrolled = segment.scrollLeft;
    segment.style.removeProperty(PEEK_PROPERTY);

    for (const label of Array.from(segment.querySelectorAll('ion-segment-button ion-label'))) resize?.observe(label);

    const geometry = readTabbarGeometry(segment);
    const width = geometry ? peekTabWidth(geometry) : null;
    if (width !== null) {
      segment.style.setProperty(PEEK_PROPERTY, `${width}px`);
      // The tabs just changed width, so `scrollWidth` did too: re-derive which edges hide something.
      syncTabbarOverflow(segment);
    }
    // A pass that leaves the width as it was leaves the strip where the person had put it; a pass
    // that moves the width re-places the chosen tab instead.
    if (segment.style.getPropertyValue(PEEK_PROPERTY) !== published) keepSelectedTabInView(segment);
    else if (segment.scrollLeft !== scrolled) segment.scrollLeft = scrolled;
  };

  apply();

  resize?.observe(segment);
  // `childList` only: `apply` writes a style attribute on the strip itself, which this never sees.
  const tabs = typeof MutationObserver !== 'undefined' ? new MutationObserver(apply) : null;
  tabs?.observe(segment, { childList: true });

  return () => {
    if (frame) cancelAnimationFrame(frame);
    resize?.disconnect();
    tabs?.disconnect();
    segment.style.removeProperty(PEEK_PROPERTY);
  };
}
