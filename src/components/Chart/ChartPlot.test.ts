// ChartPlot — what the bar and the line chart share around their marks: the frame, the legend, the value axis and its
// rules, the labels along the bottom, and the table of the same values for a screen reader. It hands each chart the
// series as drawn and the round scale for its marks.
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { h, nextTick } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import ChartPlot from './ChartPlot.vue';
import type { DrawnSeries } from './model';
import type { Scale } from './scale';

const LABELS = ['Mon', 'Tue', 'Wed'];

function mountPlot(values: (number | null)[][], format?: (value: number) => string) {
  const series = values.map((row, index) => ({ label: `Series ${index + 1}`, values: row }));
  const seen: { series: DrawnSeries[]; scale: Scale }[] = [];
  const plot = mount(ChartPlot, {
    props: { labels: LABELS, series, mark: 'bar', description: 'Sales by day', format },
    slots: { default: (scope: { series: DrawnSeries[]; scale: Scale }) => (seen.push(scope), h('i', { class: 'marks' })) },
    global: { plugins: [createShellI18n({ locale: 'en' })] },
  });
  return Object.assign(plot, { seen });
}

describe('ChartPlot', () => {
  it('writes the value axis from the bottom up, with one rule per step, and the labels along the bottom', () => {
    const plot = mountPlot([[1200, 2400, 600]]);
    expect(plot.findAll('.ep-chart__tick').map((tick) => tick.text())).toEqual(['0', '1,000', '2,000', '3,000']);
    expect(plot.findAll('.ep-chart__rule')).toHaveLength(4);
    expect(plot.findAll('.ep-chart__label').map((label) => label.text())).toEqual(LABELS);
  });

  it('draws the marks of its chart over the rules, from the series as drawn and the scale, hidden from a screen reader', () => {
    const plot = mountPlot([[1, 2, 3]]);
    expect(plot.attributes('data-kind')).toBe('bar');
    expect(plot.get('.ep-chart__plot').attributes('aria-hidden')).toBe('true');
    expect(plot.get('.ep-chart__area').element.lastElementChild?.className).toBe('marks');
    const [{ series, scale }] = plot.seen;
    expect(series.map(({ tone, pattern }) => [tone, pattern])).toEqual([[1, 'solid']]);
    expect(scale.ticks).toEqual([0, 1, 2, 3]);
  });

  it('names two series or more in a legend, each key with the shape and colour of its marks', () => {
    expect(mountPlot([[1, 2, 3]]).find('.ep-chart__legend').exists()).toBe(false);
    const keys = mountPlot([
      [1, 2, 3],
      [3, 2, 1],
    ]).findAll('.ep-chart__key');
    expect(keys.map((key) => key.text())).toEqual(['Series 1', 'Series 2']);
    expect(keys.map((key) => key.get('.ep-chart__swatch').attributes('data-pattern'))).toEqual(['solid', 'outline']);
    expect(keys.every((key) => key.get('.ep-chart__swatch').attributes('aria-hidden') === 'true')).toBe(true);
  });

  it('gives a screen reader a table: the description as its caption, a column per series and a row per label', () => {
    const plot = mountPlot(
      [
        [10, null, 30],
        [5, 6],
      ],
      (value) => `${value} €`,
    );
    // A table does not clip its own content, so a block around it is what hides it: the table itself would widen the page.
    const hidden = plot.get('.ep-chart__table');
    expect(hidden.element.tagName).toBe('DIV');
    const table = hidden.get('table');
    expect(table.get('caption').text()).toBe('Sales by day');
    expect(table.findAll('thead th').map((th) => [th.text(), th.attributes('scope')])).toEqual([
      ['Series 1', 'col'],
      ['Series 2', 'col'],
    ]);
    expect(table.findAll('tbody tr').map((row) => [row.get('th[scope="row"]').text(), ...row.findAll('td').map((td) => td.text())])).toEqual([
      ['Mon', '10 €', '5 €'],
      ['Tue', '—', '6 €'],
      ['Wed', '30 €', '—'],
    ]);
  });
});

describe('ChartPlot: the labels along the bottom', () => {
  const HOURS = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
  let axisWidth = 337;
  const resizes: (() => void)[] = [];

  /** happy-dom lays nothing out: the axis is `axisWidth` px wide and each label 31 px, as «00:00» at 12 px. */
  function layOut(): void {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('ep-chart__labels') ? axisWidth : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('ep-chart__label') ? 31 : 0;
    });
    vi.stubGlobal(
      'ResizeObserver',
      // Like the browser's, it observes only an element and reports only the boxes it observes.
      class {
        private readonly watched = new Set<Element>();
        constructor(callback: () => void) {
          resizes.push(() => this.watched.size > 0 && callback());
        }
        observe(target: Element): void {
          if (!(target instanceof Element)) throw new TypeError('ResizeObserver.observe takes an Element');
          this.watched.add(target);
        }
        disconnect(): void {
          this.watched.clear();
        }
      },
    );
  }

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resizes.length = 0;
    axisWidth = 337;
  });

  const shown = (plot: ReturnType<typeof mount>) =>
    plot.findAll('.ep-chart__label').filter((label) => label.attributes('data-skipped') === undefined);

  it('shows every label at the centre of its band until the axis is measured', () => {
    const plot = mount(ChartPlot, {
      props: { labels: LABELS, series: [{ label: 'Sales', values: [1, 2, 3] }], mark: 'line', description: 'Sales' },
      global: { plugins: [createShellI18n({ locale: 'en' })] },
    });
    expect(shown(plot).map((label) => (label.element as HTMLElement).style.left)).toEqual(['16.67%', '50%', '83.33%']);
  });

  it('shows every Nth of 24 hours that fits the measured axis, whole, and again when the chart changes width', async () => {
    layOut();
    const plot = mount(ChartPlot, {
      props: { labels: HOURS, series: [{ label: 'Sales', values: HOURS.map((_, hour) => hour) }], mark: 'line', description: 'Sales' },
      global: { plugins: [createShellI18n({ locale: 'en' })] },
    });
    await nextTick();
    expect(shown(plot).map((label) => label.text())).toEqual(['00:00', '04:00', '08:00', '12:00', '16:00', '20:00']);
    expect((shown(plot)[0].element as HTMLElement).style.left).toBe('15.5px');
    axisWidth = 782;
    resizes.forEach((resize) => resize());
    await nextTick();
    expect(shown(plot)).toHaveLength(12);
    expect(plot.findAll('.ep-chart__label')).toHaveLength(24);
  });

  it('measures the labels when the chart appears after loading', async () => {
    layOut();
    const plot = mount(ChartPlot, {
      props: { labels: HOURS, series: [{ label: 'Sales', values: HOURS.map((_, hour) => hour) }], mark: 'line', description: 'Sales', loading: true },
      global: { plugins: [createShellI18n({ locale: 'en' })] },
    });
    await nextTick();
    await plot.setProps({ loading: false });
    await nextTick();
    expect(shown(plot)).toHaveLength(6);
  });

  it('measures again when the labels change', async () => {
    layOut();
    const plot = mount(ChartPlot, {
      props: { labels: HOURS, series: [{ label: 'Sales', values: HOURS.map((_, hour) => hour) }], mark: 'bar', description: 'Sales' },
      global: { plugins: [createShellI18n({ locale: 'en' })] },
    });
    await nextTick();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    await plot.setProps({ labels: days, series: [{ label: 'Sales', values: [1, 2, 3, 4, 5, 6, 7] }] });
    await nextTick();
    expect(shown(plot).map((label) => label.text())).toEqual(days);
  });
});
