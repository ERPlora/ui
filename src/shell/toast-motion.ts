// The physics of the toast stack, as plain numbers: how deep each toast sits and when a slide dismisses one.
// The component that paints the stack turns them into CSS.

const PEEK_PX = 14;
const SCALE_STEP = 0.05;
const GAP_PX = 8;

/** Where a toast sits, in px from the stack's edge, its scale and its height (0: its content sizes it). */
export interface ToastPlacement {
  readonly offset: number;
  readonly scale: number;
  readonly height: number;
}

/**
 * The toast at `index` (0 is the newest, in front) with the measured `heights` of the ones on screen. Collapsed, the
 * ones behind peek out smaller at the front one's height; expanded, each sits past the ones in front of it.
 */
export function toastPlacement(index: number, heights: readonly number[], expanded: boolean): ToastPlacement {
  if (expanded) {
    const offset = heights.slice(0, index).reduce((sum, height) => sum + height + GAP_PX, 0);
    return { offset, scale: 1, height: heights[index] ?? 0 };
  }
  return { offset: index * PEEK_PX, scale: 1 - index * SCALE_STEP, height: heights[0] ?? 0 };
}

/** The room the stack takes from its edge: the front toast and the peeking edges, or the whole list. */
export function stackExtent(heights: readonly number[], expanded: boolean): number {
  if (!heights.length) return 0;
  if (!expanded) return heights[0] + PEEK_PX * (heights.length - 1);
  return heights.reduce((sum, height) => sum + height, 0) + GAP_PX * (heights.length - 1);
}

/** The edge a stack slides its toasts off: the bottom one down, the top one up. */
export type SwipeAway = 'down' | 'up';
export type SwipeOut = 'left' | 'right' | SwipeAway;

export interface SwipePoint {
  readonly x: number;
  readonly y: number;
  /** ms */
  readonly t: number;
}

/** Below this the finger has not chosen a direction yet: a tap. */
const AXIS_LOCK_PX = 6;
const DISMISS_PX = 90;
const FLICK_PX_PER_MS = 0.6;
const FLICK_MIN_PX = 12;
/** A flick counts only if the finger was still moving this close to lifting. */
const FLICK_WINDOW_MS = 80;

/**
 * A slide that started at `from`. It locks to the first axis the finger moves along: sideways it follows both ways;
 * vertically only `away` from the stack's edge. It dismisses past a distance or with a fast flick.
 */
export function createSwipe(away: SwipeAway, from: SwipePoint) {
  const sign = away === 'down' ? 1 : -1;
  let axis: 'x' | 'y' | undefined;
  let last = from;
  let velocity = 0;
  let offset = { x: 0, y: 0 };

  function lock(dx: number, dy: number): void {
    if (axis || Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return;
    axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
  }

  /** The offset to paint for the finger at `point`. */
  function move(point: SwipePoint): { x: number; y: number } {
    const dx = point.x - from.x;
    const dy = point.y - from.y;
    lock(dx, dy);
    const along = axis === 'y' ? point.y - last.y : point.x - last.x;
    velocity = along / Math.max(1, point.t - last.t);
    last = point;
    if (axis === 'x') offset = { x: dx, y: 0 };
    else if (axis === 'y') offset = { x: 0, y: sign * dy > 0 ? dy : 0 };
    return offset;
  }

  /** Where the toast goes once the finger lifts at `t`; `undefined` puts it back in its place. */
  function end(t: number): SwipeOut | undefined {
    const distance = axis === 'y' ? offset.y : offset.x;
    const flick =
      t - last.t <= FLICK_WINDOW_MS &&
      Math.abs(distance) >= FLICK_MIN_PX &&
      Math.sign(velocity) === Math.sign(distance) &&
      Math.abs(velocity) >= FLICK_PX_PER_MS;
    if (!axis || (Math.abs(distance) < DISMISS_PX && !flick)) return undefined;
    if (axis === 'y') return away;
    return distance > 0 ? 'right' : 'left';
  }

  return {
    move,
    end,
    /** Whether the finger has slid at all, or only tapped. */
    get moved(): boolean {
      return axis !== undefined;
    },
  };
}
