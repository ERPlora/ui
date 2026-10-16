/**
 * Footer tab strip — make an overflowing strip SHOW that it continues (hub#1830). Ported from ERPlora
 * hub `apps/web/src/lib/tabbar-peek.ts` (origin/develop), with our token `--ep-tabbar-min`.
 *
 * `tabbar.css` paints a fade over the edge that hides tabs and `bindTabbar` hints the gesture once.
 * Neither is enough alone: a tab's icon and label are CENTRED, so when the cut leaves a narrow sliver
 * of the next tab the fade falls on empty background and the strip reads, at rest, exactly like one
 * that ends there (NN/g's illusion of completeness). What the market does on a mobile strip that
 * does not fit is leave the next tab genuinely PEEKING, cut through its own content (Material's
 * scrollable tabs, Apple's partially visible tab, Lightspeed's carousel); the enterprise web's «More»
 * menu is a desktop answer. So: pick the tab width that makes the cut fall past the centre of the
 * first hidden tab, publish it in `--ep-tabbar-min`, and keep scrolling.
 */
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
  /** `offsetWidth` of a tab. Every tab is one grid column, so they all share it. */
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
 * floor, per product: 64px in `tabbar.css`). When not even one whole tab and the peek fit at the
 * floor, the floor stands and there is no peek (hub#1841): a squeezed label is worse.
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

/** What one tab's label needs so that none of its words breaks in two (hub#2414). */
export interface TabLabelNeed {
  /** The label may break a line (`white-space` other than `nowrap`/`pre`). */
  wraps: boolean;
  /** `min-content` width of the label: its widest word, laid out with its own font. */
  wordWidth: number;
  /** What the tab spends around the label: its horizontal padding, borders and the label's margins. */
  chromeWidth: number;
}

/**
 * The narrowest tab that keeps every word of every wrapping label whole, or `null` when there is
 * nothing to hold. Labels wrap BETWEEN words (`polish.css`), but a word longer than the tab breaks by
 * a letter («Disponibilida» / «d», hub#2414); this is the measured answer, for any language, font
 * and system text size. Labels that never wrap are left out; capped at the strip's width.
 */
export function wholeWordTabWidth(labels: readonly TabLabelNeed[], visibleWidth: number): number | null {
  const needs = labels.filter((label) => label.wraps && label.wordWidth > 0);
  if (needs.length === 0) return null;
  const widest = Math.max(...needs.map((label) => label.wordWidth + label.chromeWidth));
  return Math.min(Math.ceil(widest), visibleWidth);
}

/** Sum of the given pixel lengths of a computed style (`'16px'` → 16; anything else counts as 0). */
function pixels(style: CSSStyleDeclaration, ...properties: string[]): number {
  return properties.reduce((sum, property) => sum + (Number.parseFloat(style.getPropertyValue(property)) || 0), 0);
}

/**
 * Measures what each tab's label needs, in the strip as painted right now: the widest word is the
 * label's `min-content` width (laid out at that width for an instant, inline style put back); the
 * padding lives on the button's shadow part (`.button-native`), else on the host.
 */
function readLabelNeeds(segment: HTMLElement): TabLabelNeed[] {
  const needs: TabLabelNeed[] = [];
  for (const tab of Array.from(segment.querySelectorAll<HTMLElement>('ion-segment-button'))) {
    const label = tab.querySelector<HTMLElement>('ion-label');
    if (!label) continue;
    const labelStyle = getComputedStyle(label);
    const wraps = labelStyle.whiteSpace !== 'nowrap' && labelStyle.whiteSpace !== 'pre';

    const width = label.style.getPropertyValue('width');
    const maxWidth = label.style.getPropertyValue('max-width');
    label.style.setProperty('width', 'min-content');
    label.style.setProperty('max-width', 'none');
    const wordWidth = label.getBoundingClientRect().width;
    if (width) label.style.setProperty('width', width);
    else label.style.removeProperty('width');
    if (maxWidth) label.style.setProperty('max-width', maxWidth);
    else label.style.removeProperty('max-width');

    const native = tab.shadowRoot?.querySelector<HTMLElement>('.button-native') ?? tab;
    const chromeWidth =
      pixels(getComputedStyle(native), 'padding-left', 'padding-right', 'border-left-width', 'border-right-width') +
      pixels(labelStyle, 'margin-left', 'margin-right');
    needs.push({ wraps, wordWidth, chromeWidth });
  }
  return needs;
}

/**
 * Scrolls the strip the least it takes to show its selected tab whole and one fade clear of each
 * edge that still hides tabs (hub#2414, hub#2603). The engine clamps the scroll to the strip, so
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

/** Reads the live geometry of a strip. `null` when there is not enough of it to measure a pitch. */
function readTabbarGeometry(segment: HTMLElement): TabbarGeometry | null {
  const tabs = segment.querySelectorAll<HTMLElement>('ion-segment-button');
  const first = tabs[0];
  const second = tabs[1];
  if (!first || !second) return null;
  return {
    visibleWidth: segment.clientWidth,
    contentWidth: segment.scrollWidth,
    firstTabLeft: first.offsetLeft,
    tabWidth: first.offsetWidth,
    tabPitch: second.offsetLeft - first.offsetLeft,
    tabCount: tabs.length,
  };
}

/**
 * Keeps a strip's tabs sized so the overflow stays visible and no word of a label breaks in two.
 * Returns its cleanup. Recomputes when the strip changes width, when a label changes size and when
 * the number of tabs changes. Every pass first drops the width it published last time: the floor
 * is the one the STYLESHEET declares, or it would ratchet up on every rotation of the phone.
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

    // hub#2414: the floor a wrapping label needs to keep its words whole; it only RAISES the width.
    const firstTab = segment.querySelector<HTMLElement>('ion-segment-button');
    const wholeWords = wholeWordTabWidth(readLabelNeeds(segment), segment.clientWidth);
    const widened = firstTab !== null && wholeWords !== null && wholeWords > firstTab.offsetWidth;
    if (widened) segment.style.setProperty(PEEK_PROPERTY, `${wholeWords}px`);

    for (const label of Array.from(segment.querySelectorAll('ion-segment-button ion-label'))) resize?.observe(label);

    const geometry = readTabbarGeometry(segment);
    const width = geometry ? peekTabWidth(geometry) : null;
    if (width !== null) segment.style.setProperty(PEEK_PROPERTY, `${width}px`);
    // The tabs just changed width, so `scrollWidth` did too: re-derive which edges hide something.
    if (widened || width !== null) syncTabbarOverflow(segment);
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
