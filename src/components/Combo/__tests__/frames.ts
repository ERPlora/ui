import { vi } from 'vitest';

const realInnerHeight = window.innerHeight;
/** The animation frames asked, run by hand. */
export let frames: FrameRequestCallback[];

/** A `beforeEach`: the animation frames are asked into `frames` and never run on their own. */
export function fakeFrames(): void {
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
}

/** Puts back the window's height and takes away the visual viewport a test gave it. */
export function restoreWindow(): void {
  Object.defineProperty(window, 'innerHeight', { value: realInnerHeight, configurable: true, writable: true });
  Reflect.deleteProperty(window, 'visualViewport');
}
