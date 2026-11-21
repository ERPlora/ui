// The labels along the bottom of a chart. When they do not all fit (the 24 hours of a day on a phone), every Nth is
// shown, from the first, as chart libraries do (Chart.js «autoSkip»): N is the smallest that leaves each shown label
// whole and apart from the next. Widths come from the browser, so the choice follows the chart's real width and font.
import { onBeforeUnmount, type Ref, shallowRef, watch } from 'vue';

import { bandCentre } from './scale';

export interface LabelPlace {
  index: number;
  /** Where the label is centred, in px from the axis' left edge. */
  centre: number;
  shown: boolean;
}

/** The space kept between two labels shown side by side, in px. */
const GAP = 8;

/** Every label centred under its band, moved inwards only as far as it takes to stay inside the axis. */
function centres(width: number, widths: readonly number[]): number[] {
  const band = width / widths.length;
  return widths.map((own, index) => Math.max(own / 2, Math.min((index + 0.5) * band, width - own / 2)));
}

/** Whether every `step`th label, from the first, keeps `gap` from the next one shown; `edges` are each label's left
 *  and right ends. */
function fits(step: number, edges: readonly (readonly [number, number])[], gap: number): boolean {
  for (let index = step; index < edges.length; index += step) {
    if (edges[index - step][1] + gap > edges[index][0]) return false;
  }
  return true;
}

/** Where each label of an axis `width` px wide goes, and which are shown; none before the axis has a width. */
export function placeLabels(width: number, widths: readonly number[], gap = GAP): LabelPlace[] {
  if (width <= 0 || widths.length === 0) return [];
  const centre = centres(width, widths);
  const edges = widths.map((own, index) => [centre[index] - own / 2, centre[index] + own / 2] as const);
  let step = Math.max(1, Math.ceil((Math.max(...widths) + gap) / (width / widths.length)));
  while (step < widths.length && !fits(step, edges, gap)) step += 1;
  return widths.map((_own, index) => ({ index, centre: centre[index], shown: index % step === 0 }));
}

/**
 * The labels of `box` (its children, one per label) placed on its measured width, again whenever the box appears,
 * changes size or the labels change. Until it is measured every label is shown at the centre of its band.
 */
export function useAxisLabels(box: Ref<HTMLElement | undefined>, labels: () => readonly string[]) {
  const places = shallowRef<LabelPlace[]>([]);

  function measure(): void {
    const element = box.value;
    if (!element) return;
    const widths = [...element.children].map((label) => (label as HTMLElement).offsetWidth);
    places.value = placeLabels(element.clientWidth, widths);
  }

  // The box comes and goes with the chart's states (it is not there while loading): it is watched while it exists.
  let observer: ResizeObserver | undefined;
  function follow(element: HTMLElement | undefined): void {
    observer?.disconnect();
    if (!element) return;
    if (typeof ResizeObserver !== 'undefined') {
      observer ??= new ResizeObserver(measure);
      observer.observe(element);
    }
    measure();
  }
  watch(box, follow, { flush: 'post', immediate: true });
  watch(() => labels().join('\n'), measure, { flush: 'post' });
  onBeforeUnmount(() => observer?.disconnect());

  return {
    /** Where label `index` is centred: its measured place, or the centre of its band before measuring. */
    left: (index: number): string => {
      const place = places.value[index];
      return place ? `${place.centre}px` : `${bandCentre(index, labels().length)}%`;
    },
    /** Whether label `index` is left out because it does not fit. */
    skipped: (index: number): boolean => places.value[index]?.shown === false,
  };
}
