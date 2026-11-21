// ChartPlot — what the bar and the line chart share around their marks: the frame, the legend, the value axis and its
// rules, the labels along the bottom, and the table of the same values for a screen reader. It hands each chart the
// series as drawn and the round scale for its marks.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { h } from 'vue';

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
