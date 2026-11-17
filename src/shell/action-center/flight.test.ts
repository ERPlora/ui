import { afterEach, describe, expect, it, vi } from 'vitest';

import { bellOnView, flyToBell } from './flight';

function box(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height } as DOMRect;
}

function scene() {
  const source = document.createElement('article');
  const bell = document.createElement('button');
  source.className = 'action-arrival';
  source.textContent = 'Invoice due';
  bell.dataset.actionBell = '';
  source.getBoundingClientRect = () => box(900, 72, 380, 160);
  bell.getBoundingClientRect = () => box(1340, 8, 40, 40);
  document.body.append(source, bell);
  return { source, bell };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('flyToBell', () => {
  it('clones the card and moves only its transform to the measured bell', () => {
    const { source, bell } = scene();
    const animation = { onfinish: null, oncancel: null, cancel: vi.fn() } as unknown as Animation;
    const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation);

    expect(flyToBell(source, bell)).toBe(animation);
    const ghost = document.body.querySelector<HTMLElement>('.action-arrival-ghost');
    expect(ghost?.textContent).toBe('Invoice due');
    expect(ghost?.getAttribute('aria-hidden')).toBe('true');
    expect(ghost?.style.position).toBe('fixed');
    expect(ghost?.style.left).toBe('900px');
    expect(ghost?.style.top).toBe('72px');
    expect(ghost?.style.width).toBe('380px');
    expect(animate).toHaveBeenCalledOnce();
    const [frames, options] = animate.mock.calls[0];
    expect(frames).toEqual([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: 'translate(440px, -64px) scale(0.10526315789473684)' },
    ]);
    expect(options).toEqual({ duration: 440, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' });
    expect(JSON.stringify(frames)).not.toMatch(/opacity|filter|borderRadius/);
  });

  it('removes the ghost when the flight finishes or is cancelled', () => {
    const { source, bell } = scene();
    const animation = { onfinish: null, oncancel: null, cancel: vi.fn() } as unknown as Animation;
    vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation);
    flyToBell(source, bell);
    animation.onfinish?.call(animation, new Event('finish') as AnimationPlaybackEvent);
    expect(document.body.querySelector('.action-arrival-ghost')).toBeNull();

    flyToBell(source, bell);
    animation.oncancel?.call(animation, new Event('cancel') as AnimationPlaybackEvent);
    expect(document.body.querySelector('.action-arrival-ghost')).toBeNull();
  });

  it('does nothing without a bell', () => {
    const { source } = scene();
    document.querySelector('button')?.remove();
    const animate = vi.spyOn(HTMLElement.prototype, 'animate');
    expect(flyToBell(source)).toBeUndefined();
    expect(document.body.querySelector('.action-arrival-ghost')).toBeNull();
    expect(animate).not.toHaveBeenCalled();
  });

  // Ionic keeps the pages left behind in the DOM, each with its own topbar and bell.
  it('flies to the bell of the screen on view, never to one of a page Ionic keeps behind', () => {
    const { source, bell } = scene();
    const behind = document.createElement('div');
    behind.className = 'ion-page ion-page-hidden';
    const hiddenBell = document.createElement('button');
    hiddenBell.dataset.actionBell = '';
    hiddenBell.getBoundingClientRect = () => box(0, 0, 0, 0);
    behind.append(hiddenBell);
    document.body.prepend(behind);
    const animation = { onfinish: null, oncancel: null, cancel: vi.fn() } as unknown as Animation;
    const animate = vi.spyOn(HTMLElement.prototype, 'animate').mockReturnValue(animation);
    expect(bellOnView()).toBe(bell);
    flyToBell(source);
    expect(animate.mock.calls[0][0]).toEqual([
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: 'translate(440px, -64px) scale(0.10526315789473684)' },
    ]);
  });
});
