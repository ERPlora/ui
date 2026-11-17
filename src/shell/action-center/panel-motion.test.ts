import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { panelEnterAnimation, panelLeaveAnimation } from './panel-motion';

const chain = vi.hoisted(() => {
  const value = {
    addElement: vi.fn(),
    addAnimation: vi.fn(),
    duration: vi.fn(),
    easing: vi.fn(),
    keyframes: vi.fn(),
    fromTo: vi.fn(),
  };
  for (const method of Object.values(value)) method.mockReturnValue(value);
  return value;
});

vi.mock('@ionic/vue', () => ({ createAnimation: () => chain }));

function baseWithWrapper(): { base: HTMLElement; wrapper: HTMLElement; backdrop: HTMLElement } {
  const base = document.createElement('ion-modal');
  const root = base.attachShadow({ mode: 'open' });
  const backdrop = document.createElement('ion-backdrop');
  const wrapper = document.createElement('div');
  wrapper.className = 'modal-wrapper';
  root.append(backdrop, wrapper);
  return { base, wrapper, backdrop };
}

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of Object.values(chain)) method.mockReturnValue(chain);
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ getPropertyValue: () => 'var-spring' } as unknown as CSSStyleDeclaration);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('action panel motion', () => {
  it('enters the modal wrapper from the right with transform only', () => {
    const { base, wrapper } = baseWithWrapper();
    expect(panelEnterAnimation(base)).toBe(chain);
    expect(chain.addElement).toHaveBeenCalledWith(wrapper);
    expect(chain.duration).toHaveBeenCalledWith(380);
    expect(chain.easing).toHaveBeenCalledWith('var-spring');
    const frames = chain.keyframes.mock.calls[0][0];
    expect(frames).toEqual([
      { transform: 'translateX(calc(100% + 28px))', offset: 0 },
      { transform: 'translateX(0)', offset: 1 },
    ]);
    expect(JSON.stringify(frames)).not.toMatch(/opacity|filter/);
  });

  it('leaves towards the right with the same transform-only motion', () => {
    const { base } = baseWithWrapper();
    panelLeaveAnimation(base);
    expect(chain.keyframes.mock.calls[0][0]).toEqual([
      { transform: 'translateX(0)', offset: 0 },
      { transform: 'translateX(calc(100% + 28px))', offset: 1 },
    ]);
  });

  // The backdrop lies under the glass, never above it, so its fade cannot stop the panel blurring the page.
  it('dims the page behind with the modal backdrop, as Ionic does, and lifts it on the way out', () => {
    const { base, backdrop } = baseWithWrapper();
    panelEnterAnimation(base);
    expect(chain.addElement).toHaveBeenCalledWith(backdrop);
    expect(chain.fromTo).toHaveBeenCalledWith('opacity', 0.01, 'var(--backdrop-opacity)');
    vi.clearAllMocks();
    panelLeaveAnimation(base);
    expect(chain.fromTo).toHaveBeenCalledWith('opacity', 'var(--backdrop-opacity)', 0);
  });

  it('has no animation with reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    panelEnterAnimation(baseWithWrapper().base);
    expect(chain.duration).toHaveBeenCalledWith(0);
  });
});
