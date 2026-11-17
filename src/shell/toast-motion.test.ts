import { describe, expect, it } from 'vitest';

import { createSwipe, stackExtent, toastPlacement } from './toast-motion';

describe('toastPlacement: the depth of the stack', () => {
  const heights = [56, 76, 56];

  it('collapsed, the newest is in front and each one behind is 14 px further and 0.05 smaller, at the front height', () => {
    expect(toastPlacement(0, heights, false)).toEqual({ offset: 0, scale: 1, height: 56 });
    expect(toastPlacement(1, heights, false)).toEqual({ offset: 14, scale: 0.95, height: 56 });
    expect(toastPlacement(2, heights, false)).toEqual({ offset: 28, scale: 0.9, height: 56 });
  });

  it('expanded, each one sits past the ones in front of it, 8 px apart, full size and at its own height', () => {
    expect(toastPlacement(0, heights, true)).toEqual({ offset: 0, scale: 1, height: 56 });
    expect(toastPlacement(1, heights, true)).toEqual({ offset: 64, scale: 1, height: 76 });
    expect(toastPlacement(2, heights, true)).toEqual({ offset: 148, scale: 1, height: 56 });
  });

  it('a toast not measured yet takes no height (its own content sizes it)', () => {
    expect(toastPlacement(1, [], false)).toEqual({ offset: 14, scale: 0.95, height: 0 });
  });
});

describe('stackExtent: the room the stack takes', () => {
  it('collapsed, the front toast and the edges peeking behind it', () => {
    expect(stackExtent([56, 76, 56], false)).toBe(56 + 28);
  });

  it('expanded, every toast and the gaps between them', () => {
    expect(stackExtent([56, 76, 56], true)).toBe(56 + 76 + 56 + 16);
  });

  it('none when there is nothing on screen', () => {
    expect(stackExtent([], false)).toBe(0);
    expect(stackExtent([], true)).toBe(0);
  });
});

describe('createSwipe: dismissing a toast by sliding it away', () => {
  const at = (x: number, y: number, t: number) => ({ x, y, t });

  it('follows the finger sideways and dismisses past 90 px, on the side it went', () => {
    const right = createSwipe('down', at(0, 0, 0));
    expect(right.move(at(40, 3, 200))).toEqual({ x: 40, y: 0 });
    right.move(at(95, 4, 600));
    expect(right.end(620)).toBe('right');
    const left = createSwipe('down', at(0, 0, 0));
    left.move(at(-100, 0, 700));
    expect(left.end(720)).toBe('left');
  });

  it('a slow, short slide goes back to its place', () => {
    const swipe = createSwipe('down', at(0, 0, 0));
    swipe.move(at(20, 0, 200));
    swipe.move(at(40, 0, 400));
    expect(swipe.end(410)).toBeUndefined();
  });

  it('a short, fast flick dismisses it (0.6 px/ms)', () => {
    const swipe = createSwipe('down', at(0, 0, 0));
    swipe.move(at(10, 0, 20));
    swipe.move(at(40, 0, 50));
    expect(swipe.end(55)).toBe('right');
  });

  it('a flick that stops before the finger lifts has no speed left', () => {
    const swipe = createSwipe('down', at(0, 0, 0));
    swipe.move(at(10, 0, 20));
    swipe.move(at(40, 0, 50));
    expect(swipe.end(250)).toBeUndefined();
  });

  it('a flick back towards where it started does not dismiss it', () => {
    const swipe = createSwipe('down', at(0, 0, 0));
    swipe.move(at(60, 0, 400));
    swipe.move(at(30, 0, 430));
    expect(swipe.end(432)).toBeUndefined();
  });

  it('a tap is not a slide: nothing moves and nothing is dismissed', () => {
    const swipe = createSwipe('down', at(0, 0, 0));
    expect(swipe.move(at(3, 2, 30))).toEqual({ x: 0, y: 0 });
    expect(swipe.moved).toBe(false);
    expect(swipe.end(40)).toBeUndefined();
  });

  it('slides away from the edge it sits on: down at the bottom, up at the top, never the other way', () => {
    const bottom = createSwipe('down', at(0, 0, 0));
    expect(bottom.move(at(2, 95, 600))).toEqual({ x: 0, y: 95 });
    expect(bottom.moved).toBe(true);
    expect(bottom.end(610)).toBe('down');
    const upwards = createSwipe('down', at(0, 0, 0));
    expect(upwards.move(at(0, -120, 600))).toEqual({ x: 0, y: 0 });
    expect(upwards.end(610)).toBeUndefined();
    const top = createSwipe('up', at(0, 0, 0));
    expect(top.move(at(0, -100, 600))).toEqual({ x: 0, y: -100 });
    expect(top.end(610)).toBe('up');
  });
});
