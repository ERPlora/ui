// Contract of the footer TABBAR (an `ion-segment` used as navigation), ported from OutfitKit's
// `src/tabbar/tabbar.test.ts` (origin/main; PLAN §16.11) with the class names of our `tabbar.css`
// (`.tabbar`, `.tabbar-dragging`). It fills a real gap of Ionic: `ion-segment` does not bring the
// checked tab into view and cannot tell whether it overflows nor where its scroll is.
//
// happy-dom lays nothing out: offsetLeft/offsetWidth/clientWidth/scrollWidth are 0 and read-only,
// so they are pinned per instance with defineProperty.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bindTabbar,
  FADE_PX,
  hintScroll,
  scrollActiveTabIntoView,
  shouldHintScroll,
  syncTabbarOverflow,
  tabbarOverflow,
} from './tabbar';

function metrics(el: HTMLElement, m: Record<string, number>): void {
  for (const [k, v] of Object.entries(m)) Object.defineProperty(el, k, { configurable: true, value: v });
}

/** A segment of `n` 84px tabs in a strip `clientWidth` wide, with the `active` one checked. */
function segmentWith(n: number, active: number, clientWidth: number): HTMLElement {
  const seg = document.createElement('ion-segment');
  metrics(seg, { clientWidth, scrollWidth: n * 84 });
  for (let i = 0; i < n; i++) {
    const b = document.createElement('ion-segment-button');
    if (i === active) b.classList.add('segment-button-checked');
    metrics(b, { offsetLeft: i * 84, offsetWidth: 84 });
    seg.appendChild(b);
  }
  seg.scrollLeft = 0;
  document.body.appendChild(seg);
  return seg;
}

afterEach(() => {
  // A failed assertion inside a fake-timer test must not leave the next test without real timers.
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('FADE_PX', () => {
  it('is the default of --ep-tabbar-fade in tabbar.css: revealing a tab must clear the fade the CSS paints', () => {
    const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'theme/tabbar.css'), 'utf8');
    const defaults = [...css.matchAll(/var\(--ep-tabbar-fade, (\d+)px\)/g)].map((m) => Number(m[1]));
    expect(defaults.length).toBeGreaterThan(0);
    expect(new Set(defaults)).toEqual(new Set([FADE_PX]));
  });
});

describe('tabbarOverflow', () => {
  it('marks no edge when everything fits', () => {
    const seg = segmentWith(3, 0, 382);
    metrics(seg, { scrollWidth: 252 });
    expect(tabbarOverflow(seg)).toBe('none');
  });

  it('at the start marks only the right edge', () => {
    expect(tabbarOverflow(segmentWith(6, 0, 382))).toBe('end');
  });

  it('half way marks both edges', () => {
    const seg = segmentWith(6, 0, 382);
    seg.scrollLeft = 60;
    expect(tabbarOverflow(seg)).toBe('both');
  });

  it('at the end marks only the left one: the fade is not left hanging', () => {
    const seg = segmentWith(6, 0, 382);
    seg.scrollLeft = 504 - 382;
    expect(tabbarOverflow(seg)).toBe('start');
  });

  it('tolerates the sub-pixel', () => {
    const seg = segmentWith(6, 0, 382);
    seg.scrollLeft = 504 - 382 - 0.5;
    expect(tabbarOverflow(seg)).toBe('start');
  });

  it('without a segment, none', () => {
    expect(tabbarOverflow(null)).toBe('none');
  });
});

describe('syncTabbarOverflow', () => {
  it('publishes the state in data-overflow for the CSS to read', () => {
    const seg = segmentWith(6, 0, 382);
    syncTabbarOverflow(seg);
    expect(seg.dataset.overflow).toBe('end');
  });
});

describe('scrollActiveTabIntoView', () => {
  it('brings the active tab in when it is off to the right, one fade clear of the edge (clamped)', () => {
    const seg = segmentWith(5, 4, 382);
    scrollActiveTabIntoView(seg);
    expect(seg.scrollLeft).toBe(38); // [336,420] → the max, 420-382
  });

  it('brings the active tab in when it is off to the left', () => {
    const seg = segmentWith(5, 0, 382);
    seg.scrollLeft = 200;
    scrollActiveTabIntoView(seg);
    expect(seg.scrollLeft).toBe(0);
  });

  it('does not move the bar when the active tab is visible, also mid-strip', () => {
    const seg = segmentWith(5, 1, 382);
    scrollActiveTabIntoView(seg);
    expect(seg.scrollLeft).toBe(0);
    const mid = segmentWith(10, 4, 382); // tab 4 at 336..420, window 200..582
    mid.scrollLeft = 200;
    scrollActiveTabIntoView(mid);
    expect(mid.scrollLeft).toBe(200);
  });

  it('revealing to the LEFT clears the fade too', () => {
    const seg = segmentWith(10, 2, 382); // tab 2 at 168..252, off the window 300..682
    seg.scrollLeft = 300;
    scrollActiveTabIntoView(seg);
    expect(seg.scrollLeft).toBe(168 - FADE_PX);
  });
});

describe('shouldHintScroll', () => {
  it('hints when tabs are left to the right', () => {
    expect(shouldHintScroll({ overflow: 'end', reducedMotion: false, alreadyScrolled: false })).toBe(true);
    expect(shouldHintScroll({ overflow: 'both', reducedMotion: false, alreadyScrolled: false })).toBe(true);
  });

  it('not when all fit, at the end, with reduced motion, or when the bar already moved', () => {
    expect(shouldHintScroll({ overflow: 'none', reducedMotion: false, alreadyScrolled: false })).toBe(false);
    expect(shouldHintScroll({ overflow: 'start', reducedMotion: false, alreadyScrolled: false })).toBe(false);
    expect(shouldHintScroll({ overflow: 'end', reducedMotion: true, alreadyScrolled: false })).toBe(false);
    expect(shouldHintScroll({ overflow: 'both', reducedMotion: false, alreadyScrolled: true })).toBe(false);
  });
});

describe('hintScroll', () => {
  it('peeks and comes back', () => {
    vi.useFakeTimers();
    const seg = segmentWith(6, 0, 382);
    const moves: number[] = [];
    seg.scrollTo = ((o: { left: number }) => moves.push(o.left)) as unknown as typeof seg.scrollTo;
    hintScroll(seg);
    expect(moves).toEqual([28]);
    vi.runAllTimers();
    expect(moves).toEqual([28, 0]);
    vi.useRealTimers();
  });
});

describe('bindTabbar', () => {
  it('marks the segment with the class tabbar.css styles', () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg);
    expect(seg.classList.contains('tabbar')).toBe(true);
  });

  it('publishes the initial state without waiting for a scroll, and follows the scroll', () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg);
    expect(seg.dataset.overflow).toBe('end');
    seg.scrollLeft = 60;
    seg.dispatchEvent(new Event('scroll'));
    expect(seg.dataset.overflow).toBe('both');
  });

  it('the cleanup stops listening', () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg)();
    seg.scrollLeft = 60;
    seg.dispatchEvent(new Event('scroll'));
    expect(seg.dataset.overflow).toBe('end');
  });

  it('without a segment returns a harmless cleanup', () => {
    expect(() => bindTabbar(null)()).not.toThrow();
  });
});

// hub#1734: landing on a deep link, on `back` or on the last tab left the CHECKED tab off screen.
describe('bindTabbar - reveals the active tab', () => {
  it('on mount, brings a route-selected tab into view and moves the fade after revealing', () => {
    const seg = segmentWith(6, 5, 382);
    bindTabbar(seg, { hint: false });
    expect(seg.scrollLeft).toBe(122);
    expect(seg.dataset.overflow).toBe('start');
  });

  it('follows the active tab when it CHANGES, not only on mount', async () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg, { hint: false });
    const buttons = [...seg.querySelectorAll('ion-segment-button')];
    buttons[0].classList.remove('segment-button-checked');
    buttons[5].classList.add('segment-button-checked');
    await vi.waitFor(() => expect(seg.scrollLeft).toBe(122));
  });

  it('does not hint on top of the reveal; still hints when nothing had to be revealed', () => {
    vi.useFakeTimers();
    const revealed = segmentWith(6, 5, 382);
    const moves: number[] = [];
    revealed.scrollTo = ((o: { left: number }) => moves.push(o.left)) as unknown as typeof revealed.scrollTo;
    bindTabbar(revealed);
    vi.advanceTimersByTime(500);
    expect(moves).toEqual([]);

    const plain = segmentWith(6, 0, 382);
    const plainMoves: number[] = [];
    plain.scrollTo = ((o: { left: number }) => plainMoves.push(o.left)) as unknown as typeof plain.scrollTo;
    bindTabbar(plain);
    vi.advanceTimersByTime(500);
    expect(plainMoves).toEqual([28]);
    vi.useRealTimers();
  });

  it('a press on another tab, or the start of a drag, does not yank the bar back to the checked one', async () => {
    const seg = segmentWith(6, 5, 382);
    bindTabbar(seg, { hint: false });
    seg.scrollLeft = 0;
    seg.querySelectorAll('ion-segment-button')[1].classList.add('ion-activated');
    seg.classList.add('tabbar-dragging');
    await new Promise((r) => setTimeout(r, 20));
    expect(seg.scrollLeft).toBe(0);
  });

  it('ignores its OWN data-overflow writes', async () => {
    const seg = segmentWith(6, 5, 382);
    bindTabbar(seg, { hint: false });
    seg.scrollLeft = 0;
    seg.dataset.overflow = 'none';
    await new Promise((r) => setTimeout(r, 20));
    expect(seg.scrollLeft).toBe(0);
  });

  it('the cleanup stops following the active tab too', async () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg, { hint: false })();
    const buttons = [...seg.querySelectorAll('ion-segment-button')];
    buttons[0].classList.remove('segment-button-checked');
    buttons[5].classList.add('segment-button-checked');
    await new Promise((r) => setTimeout(r, 20));
    expect(seg.scrollLeft).toBe(0);
  });
});

// A finger already pans natively; a MOUSE drag has to be wired, and only a mouse (or a pen).
describe('bindTabbar - drag to scroll', () => {
  const pointer = (type: string, x: number, extra: Record<string, unknown> = {}) =>
    new PointerEvent(type, { pointerId: 1, pointerType: 'mouse', clientX: x, buttons: 1, bubbles: true, ...extra });

  it('with a MOUSE, dragging left scrolls the strip to the right', () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg, { hint: false });
    seg.scrollLeft = 100;
    seg.dispatchEvent(pointer('pointerdown', 300));
    seg.dispatchEvent(pointer('pointermove', 220));
    expect(seg.scrollLeft).toBe(180);
  });

  it('with a FINGER it leaves scrollLeft alone, and a wobble under the threshold moves nothing', () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg, { hint: false });
    seg.scrollLeft = 100;
    seg.dispatchEvent(pointer('pointerdown', 300, { pointerType: 'touch' }));
    seg.dispatchEvent(pointer('pointermove', 220, { pointerType: 'touch' }));
    expect(seg.scrollLeft).toBe(100);
    seg.dispatchEvent(pointer('pointerdown', 300));
    seg.dispatchEvent(pointer('pointermove', 298));
    expect(seg.scrollLeft).toBe(100);
  });

  it('after a real drag the following click does NOT reach the tab; a clean click still does', () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg, { hint: false });
    const tab = seg.children[3] as HTMLElement;
    let selected = 0;
    tab.addEventListener('click', () => (selected += 1));

    seg.dispatchEvent(pointer('pointerdown', 300));
    seg.dispatchEvent(pointer('pointermove', 220));
    seg.dispatchEvent(pointer('pointerup', 220));
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selected, 'releasing a drag over a tab must not navigate to it').toBe(0);

    seg.dispatchEvent(pointer('pointerdown', 300));
    seg.dispatchEvent(pointer('pointerup', 300));
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selected).toBe(1);
  });

  it('a keyboard click on a focused tab is never swallowed, even after a drag released outside', async () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg, { hint: false });
    const tab = seg.children[3] as HTMLElement;
    let selected = false;
    tab.addEventListener('click', () => (selected = true));
    seg.dispatchEvent(pointer('pointerdown', 300));
    window.dispatchEvent(pointer('pointermove', 220));
    window.dispatchEvent(pointer('pointerup', 220));
    await new Promise((resolve) => setTimeout(resolve, 0));
    tab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(selected).toBe(true);
  });

  it('survives the pointer leaving the strip before the threshold (watched on window)', () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg, { hint: false });
    seg.scrollLeft = 100;
    seg.dispatchEvent(pointer('pointerdown', 300));
    window.dispatchEvent(pointer('pointermove', 220));
    expect(seg.scrollLeft).toBe(180);
  });

  it('gives up when the button is no longer down, and ignores the secondary button', () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg, { hint: false });
    seg.scrollLeft = 100;
    seg.dispatchEvent(pointer('pointerdown', 300));
    window.dispatchEvent(pointer('pointermove', 260));
    expect(seg.scrollLeft).toBe(140);
    window.dispatchEvent(pointer('pointermove', 200, { buttons: 0 }));
    expect(seg.scrollLeft).toBe(140);
    expect(seg.classList.contains('tabbar-dragging')).toBe(false);

    seg.dispatchEvent(pointer('pointerdown', 300, { button: 2, buttons: 2 }));
    window.dispatchEvent(pointer('pointermove', 220, { buttons: 2 }));
    expect(seg.scrollLeft).toBe(140);
  });

  it('the cleanup unhooks the drag too', () => {
    const seg = segmentWith(6, 0, 382);
    bindTabbar(seg, { hint: false })();
    seg.scrollLeft = 100;
    seg.dispatchEvent(pointer('pointerdown', 300));
    seg.dispatchEvent(pointer('pointermove', 220));
    expect(seg.scrollLeft).toBe(100);
  });
});
