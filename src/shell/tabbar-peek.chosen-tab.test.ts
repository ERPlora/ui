// On a phone, the chosen tab is left clear of the edge fade. After a pass that widens the tabs, the chosen tab is whole
// and no fade falls on it: it sits at least FADE_PX away from an edge that still hides tabs, or the strip is scrolled to
// its end there. happy-dom lays nothing out, so every geometry below is pinned by hand.
import { describe, expect, it } from 'vitest';

import { FADE_PX, tabbarOverflow } from './tabbar';
import { bindTabbarPeek } from './tabbar-peek';

interface StripSpec {
  /** Where the strip's border box sits in the viewport. */
  viewportLeft: number;
  /** `clientWidth`. */
  visibleWidth: number;
  /** `offsetLeft` of the first tab: the strip's leading padding (also its trailing one). */
  padding: number;
  /** Gap between two tabs. */
  gap: number;
  /** The width the stylesheet gives a tab before the peek widens it (the module floor). */
  floorWidth: number;
  tabCount: number;
  /** Index of the chosen tab. */
  selected: number;
  /** Where Ionic left the strip, already clamped by the engine to the narrow layout. */
  scrollLeft: number;
}

/** Kitchen › Settings in `ios` at 375x667: Ionic centred it on 116px tabs and got clamped to 237. */
const IOS_SETTINGS: StripSpec = {
  viewportLeft: 4,
  visibleWidth: 367,
  padding: 4,
  gap: 4,
  floorWidth: 116,
  tabCount: 5,
  selected: 4,
  scrollLeft: 237,
};

/** Kitchen › History in `md` at 375x667: Ionic asked for 234.5 and the 604px strip clamped it to 229. */
const MD_HISTORY: StripSpec = {
  viewportLeft: 0,
  visibleWidth: 375,
  padding: 4,
  gap: 4,
  floorWidth: 116,
  tabCount: 5,
  selected: 3,
  scrollLeft: 229,
};

/**
 * A strip that lays itself out like the engine does: each tab is as wide as the published
 * `--ep-tabbar-min` (or the floor), `scrollWidth` follows, and `scrollLeft` is clamped to it.
 * Both coordinate systems the code may read are served: offsets and client rects.
 */
function strip(spec: StripSpec): HTMLElement {
  const segment = document.createElement('ion-segment');
  const tabWidth = (): number =>
    Number.parseFloat(segment.style.getPropertyValue('--ep-tabbar-min')) || spec.floorWidth;
  const contentWidth = (): number => 2 * spec.padding + spec.tabCount * tabWidth() + (spec.tabCount - 1) * spec.gap;
  const maxScroll = (): number => Math.max(0, contentWidth() - spec.visibleWidth);
  let scrollLeft = spec.scrollLeft;

  Object.defineProperty(segment, 'clientWidth', { get: () => spec.visibleWidth });
  Object.defineProperty(segment, 'scrollWidth', { get: () => contentWidth() });
  Object.defineProperty(segment, 'scrollLeft', {
    get: () => Math.min(scrollLeft, maxScroll()),
    set: (value: number) => {
      scrollLeft = Math.max(0, Math.min(value, maxScroll()));
    },
  });
  segment.getBoundingClientRect = () => new DOMRect(spec.viewportLeft, 0, spec.visibleWidth, 56);

  for (let i = 0; i < spec.tabCount; i += 1) {
    const tab = document.createElement('ion-segment-button');
    if (i === spec.selected) tab.classList.add('segment-button-checked');
    const left = (): number => spec.padding + i * (tabWidth() + spec.gap);
    Object.defineProperty(tab, 'offsetLeft', { get: left });
    Object.defineProperty(tab, 'offsetWidth', { get: tabWidth });
    tab.getBoundingClientRect = () => new DOMRect(spec.viewportLeft + left() - segment.scrollLeft, 0, tabWidth(), 56);
    segment.appendChild(tab);
  }
  document.body.appendChild(segment);
  return segment;
}

/** How far the chosen tab reaches into a fade, per edge (0 when clear), in the strip's own coordinates. */
function underFade(segment: HTMLElement): { start: number; end: number; whole: boolean } {
  const tab = segment.querySelector<HTMLElement>('.segment-button-checked')!;
  const overflow = tabbarOverflow(segment);
  const visibleStart = segment.scrollLeft;
  const visibleEnd = visibleStart + segment.clientWidth;
  const left = tab.offsetLeft;
  const right = left + tab.offsetWidth;
  const fadeStart = overflow === 'start' || overflow === 'both' ? FADE_PX : 0;
  const fadeEnd = overflow === 'end' || overflow === 'both' ? FADE_PX : 0;
  return {
    start: Math.max(0, visibleStart + fadeStart - left),
    end: Math.max(0, right - (visibleEnd - fadeEnd)),
    whole: left >= visibleStart - 0.5 && right <= visibleEnd + 0.5,
  };
}

describe('bindTabbarPeek leaves the chosen tab clear of the edge fade', () => {
  it('ios: the LAST tab takes the strip to its end, so no fade is left over it', () => {
    const segment = strip(IOS_SETTINGS);
    const unbind = bindTabbarPeek(segment);

    expect(segment.style.getPropertyValue('--ep-tabbar-min'), 'the peek widened the tabs').not.toBe('');
    expect(underFade(segment)).toEqual({ start: 0, end: 0, whole: true });
    expect(tabbarOverflow(segment), 'nothing left to hide after the last tab').toBe('start');
    unbind();
  });

  it('md: a middle tab Ionic left near the edge is moved out from under the fade', () => {
    const segment = strip(MD_HISTORY);
    const unbind = bindTabbarPeek(segment);

    expect(underFade(segment)).toEqual({ start: 0, end: 0, whole: true });
    expect(tabbarOverflow(segment), 'tabs still hidden on both sides').toBe('both');
    unbind();
  });

  it('moves the strip the least it takes: exactly one fade away from the edge', () => {
    const segment = strip(MD_HISTORY);
    const unbind = bindTabbarPeek(segment);
    const tab = segment.querySelector<HTMLElement>('.segment-button-checked')!;

    const right = tab.offsetLeft + tab.offsetWidth;
    expect(segment.scrollLeft).toBeCloseTo(right - segment.clientWidth + FADE_PX, 5);
    unbind();
  });

  it('a tab at the START side is kept a fade away from the leading edge', () => {
    // The person had scrolled to the end and the chosen tab is the second one: a width change must
    // not leave it under the leading fade.
    const segment = strip({ ...MD_HISTORY, selected: 1, scrollLeft: 229 });
    const unbind = bindTabbarPeek(segment);

    expect(underFade(segment)).toEqual({ start: 0, end: 0, whole: true });
    const tab = segment.querySelector<HTMLElement>('.segment-button-checked')!;
    expect(segment.scrollLeft).toBeCloseTo(tab.offsetLeft - FADE_PX, 5);
    unbind();
  });

  it('the FIRST tab takes the strip back to its start', () => {
    const segment = strip({ ...IOS_SETTINGS, selected: 0, scrollLeft: 120 });
    const unbind = bindTabbarPeek(segment);

    expect(segment.scrollLeft).toBe(0);
    expect(underFade(segment)).toEqual({ start: 0, end: 0, whole: true });
    unbind();
  });

  it('a tab too wide to clear both fades keeps its LEADING edge clear: its label starts there', () => {
    // 160px tabs on a 200px strip: 160 > 200 - 2 * FADE_PX, so one fade has to fall on it.
    const segment = strip({
      viewportLeft: 0,
      visibleWidth: 200,
      padding: 4,
      gap: 4,
      floorWidth: 160,
      tabCount: 3,
      selected: 1,
      scrollLeft: 0,
    });
    const unbind = bindTabbarPeek(segment);
    const tab = segment.querySelector<HTMLElement>('.segment-button-checked')!;

    expect(segment.scrollLeft).toBeCloseTo(tab.offsetLeft - FADE_PX, 5);
    expect(underFade(segment).start).toBe(0);
    unbind();
  });

  it('leaves alone a chosen tab that is already clear of the fade', () => {
    // Stations, centred: after the widening it sits well inside the strip. Nothing to fix, nothing moved
    // beyond what the width change itself demanded.
    const segment = strip({ ...IOS_SETTINGS, selected: 2, scrollLeft: 237 });
    const unbind = bindTabbarPeek(segment);

    expect(segment.scrollLeft).toBe(237);
    expect(underFade(segment)).toEqual({ start: 0, end: 0, whole: true });
    unbind();
  });

  it('a pass that does not change the width never scrolls the strip (the person moved it)', async () => {
    const segment = strip(IOS_SETTINGS);
    const unbind = bindTabbarPeek(segment);
    // The person drags the strip back to look at the first tabs, leaving the chosen one under the fade.
    segment.scrollLeft = 100;
    // A pass that lands on the same width (here, the strip's children change): it keeps the person's scroll.
    segment.appendChild(document.createElement('span'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(segment.scrollLeft).toBe(100);
    unbind();
  });
});
