/** Input of `decideRowActionsFit`: what gets measured of the hole the table lives in. */
export interface RowActionsFitInput {
  /** Visible width of the scrolling container (`clientWidth`). */
  containerWidth: number;
  /** Width the grid needs right now (`scrollWidth`: its minimum when it overflows). */
  contentWidth: number;
  /** Are the row actions folded into the «…» menu right now? */
  collapsed: boolean;
  /** Container width the current decision was taken at (`-1` = none yet). */
  decidedAtWidth: number;
}

export interface RowActionsFitDecision {
  collapsed: boolean;
  decidedAtWidth: number;
}

/** Input of `decideFitLevel`. */
export interface FitLevelInput {
  /** Visible width of the scrolling container (`clientWidth`). */
  containerWidth: number;
  /** Width the grid needs right now (`scrollWidth`: its minimum when it overflows). */
  contentWidth: number;
  /** Steps of the ladder applied right now (0 = none). */
  level: number;
  /** How many steps the table's ladder has. */
  steps: number;
  /** Container width the current decision was taken at (`-1` = none yet). */
  decidedAtWidth: number;
  /** The screen shows `level` (nothing written since the last render): the measurement is of it. */
  settled: boolean;
}

export interface FitLevelDecision {
  level: number;
  decidedAtWidth: number;
}

/**
 * How many steps of the ladder (`DataTableFitStep`) the list needs to fit its box. Decided by
 * MEASURING, one step per measurement of what is on screen: what a step frees is only known once it
 * is painted. PURE, and it never oscillates: while the box keeps its width the level only goes up,
 * and only from a settled measurement (never twice from the same stale one). A box that changes
 * width is judged from scratch, with nothing given up; in ONE pass when nothing is (`contentWidth`
 * is then that very measurement).
 */
export function decideFitLevel(input: FitLevelInput): FitLevelDecision {
  const { containerWidth, contentWidth, level, steps, decidedAtWidth, settled } = input;
  // No width, no measurement: inside `ion-content` the hole is 0 wide until Ionic hydrates.
  if (!(containerWidth > 0)) return { level, decidedAtWidth };
  const overflows = contentWidth > containerWidth;
  if (containerWidth !== decidedAtWidth) {
    if (level > 0) return { level: 0, decidedAtWidth: containerWidth };
    return { level: overflows && steps > 0 ? 1 : 0, decidedAtWidth: containerWidth };
  }
  if (settled && overflows && level < steps) return { level: level + 1, decidedAtWidth };
  return { level, decidedAtWidth };
}

/**
 * Do the row action buttons fit, or do they fold into the «…» menu? The one-step ladder of
 * `decideFitLevel`: folding narrows the grid, which fires the observer again; `decidedAtWidth`
 * makes the state move once at most while the hole keeps its size. A hole that changes size is
 * judged from scratch with the buttons out, in ONE pass when they already are out.
 */
export function decideRowActionsFit(input: RowActionsFitInput): RowActionsFitDecision {
  const { containerWidth, contentWidth, collapsed, decidedAtWidth } = input;
  const next = decideFitLevel({ containerWidth, contentWidth, level: collapsed ? 1 : 0, steps: 1, decidedAtWidth, settled: true });
  return { collapsed: next.level > 0, decidedAtWidth: next.decidedAtWidth };
}

/** The px a column asks for to hold its content whole: nothing while its
 *  floor holds it; beyond, its measured width rounded up, plus a pixel of slack for subpixel text. PURE. */
export function columnNeed(natural: number, floor: number): number {
  return natural > floor ? Math.ceil(natural) + 1 : 0;
}

/** Are `next` the needs on screen (`before`)? A text its box cuts reads its
 *  width rounded (`scrollWidth`) and held whole with its fraction: a pixel or two apart is the same column, or
 *  every rung would start the ladder again. A column measured for the first time, or that starts or stops asking
 *  for more than its floor, always counts: not measured is not «its floor holds it» (`gridTemplate`). PURE. */
export function sameNeeds(next: Readonly<Record<string, number>>, before: Readonly<Record<string, number>>): boolean {
  return Object.keys(next).every((key) => {
    const was = before[key];
    return was !== undefined && next[key] > 0 === was > 0 && Math.abs(next[key] - was) <= 2;
  });
}

/** The needs after a measurement (`measured`, the columns on screen). With
 *  the same rows a need only grows: a text that wraps when its column is cut reads narrower then, and taken as
 *  true the column would flip between whole and cut forever. Other rows are measured afresh. A column the rung
 *  hides keeps what it asked. PURE. */
export function nextNeeds(
  before: Readonly<Record<string, number>>,
  measured: Readonly<Record<string, number>>,
  sameRows: boolean,
): Record<string, number> {
  const next: Record<string, number> = { ...before };
  for (const [key, need] of Object.entries(measured)) next[key] = sameRows ? Math.max(before[key] ?? 0, need) : need;
  return next;
}

/** Input of `decideCardsForFit`. */
export interface CardsForFitInput {
  /** Cards are declared and nothing else owns the view (no choice by hand, no phone, no
   *  `defaultView="cards"`). */
  allowed: boolean;
  /** Width of the table's own box, in px (`0` = not laid out yet). */
  hostWidth: number;
  /** The list measured FOLDED with the fold decision settled at this width; `null` otherwise. */
  folded: { containerWidth: number; contentWidth: number } | null;
  /** The list is showing cards because it did not fit. */
  fitCards: boolean;
  /** Host width from which the list fits again (meaningful while `fitCards`). */
  fitWidth: number;
}

export interface CardsForFitDecision {
  fitCards: boolean;
  fitWidth: number;
}

/**
 * The list does not fit its hole even with the row actions folded: hand over to the cards.
 * PURE, and it never oscillates: in cards the list cannot be measured, so the width it needs is
 * remembered (host width + overflow) and the list only comes back once the host reaches it.
 */
export function decideCardsForFit(input: CardsForFitInput): CardsForFitDecision {
  const { allowed, hostWidth, folded, fitCards, fitWidth } = input;
  const idle = { fitCards: false, fitWidth: 0 };
  if (!allowed) return idle;
  if (!(hostWidth > 0)) return { fitCards, fitWidth };
  if (fitCards) return hostWidth >= fitWidth ? idle : { fitCards, fitWidth };
  if (folded && folded.containerWidth > 0 && folded.contentWidth > folded.containerWidth) {
    return { fitCards: true, fitWidth: hostWidth + folded.contentWidth - folded.containerWidth };
  }
  return idle;
}
