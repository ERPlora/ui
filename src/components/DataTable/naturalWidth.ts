/** Width an element takes in a row: its box plus its inline margins. */
const outerWidth = (el: Element): number => {
  const style = getComputedStyle(el);
  return el.getBoundingClientRect().width + (parseFloat(style.marginLeft) || 0) + (parseFloat(style.marginRight) || 0);
};

/** The buttons of an actions box side by side: their widths, the gaps between them and the box's
 *  own inline padding. Not the box's `scrollWidth` alone: the box packs its buttons to the END
 *  (`justify-content: flex-end`), so what does not fit overflows towards the inline-START, which
 *  `scrollWidth` never counts — the track stayed at the box's width and labelled buttons covered
 *  the column before them (SaaS Billing at 1440px). */
export function naturalActionsWidth(box: HTMLElement): number {
  return sideBySide(box, outerWidth);
}

/** The children of a box side by side: `widthOf` each, the gaps between them and the box's inline padding. */
function sideBySide(box: HTMLElement, widthOf: (child: Element) => number): number {
  const style = getComputedStyle(box);
  let sum = 0;
  let laidOut = 0;
  for (const child of Array.from(box.children)) {
    const width = widthOf(child);
    if (width <= 0) continue;
    sum += width;
    laidOut += 1;
  }
  if (laidOut === 0) return 0;
  const gap = parseFloat(style.columnGap) || 0;
  return sum + gap * (laidOut - 1) + (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
}

/** Width a cell's content takes on one line: a text its box cuts counts
 *  whole (`scrollWidth`), whatever the column is given right now. */
export const naturalCellWidth = (cell: HTMLElement): number =>
  sideBySide(cell, (child) => outerWidth(child) + Math.max(0, child.scrollWidth - child.getBoundingClientRect().width));
