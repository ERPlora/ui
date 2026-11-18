export function wholeRowsHeight(available: number, heights: number[]): number | undefined {
  const total = heights.reduce((sum, height) => sum + height, 0);
  if (!(available > 0) || total <= available) return undefined;
  let used = (heights[0] ?? 0) + (heights[1] ?? 0);
  for (const height of heights.slice(2)) {
    if (used + height > available) break;
    used += height;
  }
  return used;
}

export function fitWholeRows(scroll: HTMLElement | null, enabled: boolean): void {
  if (!scroll) return;
  scroll.style.maxHeight = '';
  if (!enabled) return;
  const rows = [...scroll.querySelectorAll<HTMLElement>('.data-table__row')];
  const height = wholeRowsHeight(scroll.clientHeight, rows.map((row) => row.offsetHeight));
  if (height) scroll.style.maxHeight = `${height}px`;
}
