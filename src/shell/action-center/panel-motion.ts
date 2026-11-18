import { type Animation, createAnimation } from '@ionic/vue';

const DURATION_MS = 380;
const OFF_SCREEN = 'translateX(calc(100% + 28px))';
const ON_SCREEN = 'translateX(0)';
const DIMMED = 'var(--backdrop-opacity)';

function motion(base: HTMLElement, leaving: boolean): Animation {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const spring = getComputedStyle(document.documentElement).getPropertyValue('--ep-spring').trim() || 'ease-out';
  const frames = leaving
    ? [{ transform: ON_SCREEN, offset: 0 }, { transform: OFF_SCREEN, offset: 1 }]
    : [{ transform: OFF_SCREEN, offset: 0 }, { transform: ON_SCREEN, offset: 1 }];
  const root = base.shadowRoot;
  const wrapper = root?.querySelector<HTMLElement>('.modal-wrapper') ?? base;
  const panel = createAnimation().addElement(wrapper).keyframes(frames);
  const backdrop = root?.querySelector<HTMLElement>('ion-backdrop');
  const animations = [panel];
  if (backdrop) {
    const dim = createAnimation().addElement(backdrop);
    animations.push(leaving ? dim.fromTo('opacity', DIMMED, 0) : dim.fromTo('opacity', 0.01, DIMMED));
  }
  return createAnimation()
    .addElement(base)
    .duration(reduced ? 0 : DURATION_MS)
    .easing(spring)
    .addAnimation(animations);
}

export function panelEnterAnimation(base: HTMLElement): Animation {
  return motion(base, false);
}

export function panelLeaveAnimation(base: HTMLElement): Animation {
  return motion(base, true);
}
