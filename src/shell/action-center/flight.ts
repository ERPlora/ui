import { isOnView } from '../toast-anchor';

const FLIGHT_MS = 440;
const FLIGHT_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** The bell of the screen on view: Ionic keeps the pages left behind in the DOM, each with its topbar and bell. */
export function bellOnView(): HTMLElement | undefined {
  return [...document.querySelectorAll<HTMLElement>('[data-action-bell]')].find(isOnView);
}

/** Sends a snapshot of the card to the bell; the live card can leave the Vue tree immediately. */
export function flyToBell(source: HTMLElement, bell: HTMLElement | undefined = bellOnView()): Animation | undefined {
  if (!bell) return undefined;
  const from = source.getBoundingClientRect();
  const to = bell.getBoundingClientRect();
  const ghost = source.cloneNode(true) as HTMLElement;
  ghost.classList.add('action-arrival-ghost');
  ghost.setAttribute('aria-hidden', 'true');
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
    margin: '0',
    pointerEvents: 'none',
    transformOrigin: 'top left',
    zIndex: '70000',
  });
  document.body.append(ghost);
  if (typeof ghost.animate !== 'function') {
    ghost.remove();
    return undefined;
  }
  const x = to.left - from.left;
  const y = to.top - from.top;
  const scale = to.width / from.width;
  const animation = ghost.animate(
    [
      { transform: 'translate(0px, 0px) scale(1)' },
      { transform: `translate(${x}px, ${y}px) scale(${scale})` },
    ],
    { duration: FLIGHT_MS, easing: FLIGHT_EASING, fill: 'forwards' },
  );
  const remove = (): void => ghost.remove();
  animation.onfinish = remove;
  animation.oncancel = remove;
  return animation;
}
