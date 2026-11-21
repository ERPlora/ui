// BarChart — values per label as vertical bars on a round scale from zero, one bar per series side by side, in the
// colours of data. With two series or more each has its own shape as well as its colour, and a legend names them.
// The drawing is for the eye; a screen reader reads the description and the table of the same values.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import { createShellI18n } from '../../shell/i18n';
import * as components from '../index';
import BarChart from './BarChart.vue';
import * as entry from './index';
import type { ChartProps } from './types';

const WEEK: ChartProps = {
  labels: ['Mon', 'Tue', 'Wed'],
  series: [{ label: 'This week', values: [150, 300, 75] }],
  description: 'Sales by day: Tuesday is the highest, 300.',
};

function mountChart(props: Partial<ChartProps> = {}) {
  return mount(BarChart, { props: { ...WEEK, ...props }, global: { plugins: [createShellI18n({ locale: 'en' })] } });
}

type Chart = ReturnType<typeof mountChart>;

const texts = (chart: Chart, selector: string): string[] => chart.findAll(selector).map((part) => part.text());
const bars = (chart: Chart) => chart.findAll('.ep-chart__bar');

describe('BarChart entry points', () => {
  it('is exported by its folder, by @erplora/ui/components and by the package root', () => {
    expect(entry.BarChart).toBe(BarChart);
    expect((components as Record<string, unknown>).BarChart).toBe(BarChart);
    expect((root as Record<string, unknown>).BarChart).toBe(BarChart);
  });
});

describe('BarChart: the bars', () => {
  it('is a figure with one group of bars per label, each bar as tall as its value on a round scale from zero', () => {
    const chart = mountChart();
    expect(chart.element.tagName).toBe('FIGURE');
    expect(chart.classes()).toContain('ep-chart');
    expect(chart.attributes('data-kind')).toBe('bars');
    expect(chart.attributes('data-state')).toBe('ready');
    expect(chart.findAll('.ep-chart__group')).toHaveLength(3);
    expect(texts(chart, '.ep-chart__label')).toEqual(['Mon', 'Tue', 'Wed']);
    expect(texts(chart, '.ep-chart__tick')).toEqual(['0', '100', '200', '300']);
    expect(chart.findAll('.ep-chart__rule')).toHaveLength(4);
    expect(bars(chart).map((bar) => [(bar.element as HTMLElement).style.bottom, (bar.element as HTMLElement).style.height])).toEqual([
      ['0%', '50%'],
      ['0%', '100%'],
      ['0%', '25%'],
    ]);
  });

  it('paints a single series solid in series 1, or in the tone it asks for, with no legend', () => {
    expect(bars(mountChart()).map((bar) => [bar.attributes('data-tone'), bar.attributes('data-pattern')])).toEqual([
      ['1', 'solid'],
      ['1', 'solid'],
      ['1', 'solid'],
    ]);
    const toned = mountChart({ series: [{ label: 'Tickets', values: [5, 9, 7], tone: 2 }] });
    expect(bars(toned).every((bar) => bar.attributes('data-tone') === '2')).toBe(true);
    expect(toned.find('.ep-chart__legend').exists()).toBe(false);
  });

  it('gives each further series its own shape as well as its colour, and names them all in a legend', () => {
    const chart = mountChart({
      series: [
        { label: 'This week', values: [150, 300, 75] },
        { label: 'Last week', values: [120, 280, 90] },
        { label: 'Same week last year', values: [100, 200, 60] },
      ],
    });
    const first = chart.get('.ep-chart__group').findAll('.ep-chart__bar');
    expect(first.map((bar) => [bar.attributes('data-tone'), bar.attributes('data-pattern')])).toEqual([
      ['1', 'solid'],
      ['2', 'outline'],
      ['3', 'dashed'],
    ]);
    expect(texts(chart, '.ep-chart__key')).toEqual(['This week', 'Last week', 'Same week last year']);
    const swatches = chart.findAll('.ep-chart__swatch');
    expect(swatches.map((swatch) => [swatch.attributes('data-mark'), swatch.attributes('data-tone'), swatch.attributes('data-pattern')])).toEqual([
      ['bar', '1', 'solid'],
      ['bar', '2', 'outline'],
      ['bar', '3', 'dashed'],
    ]);
  });

  it('draws six series at most', () => {
    const many = Array.from({ length: 7 }, (_, index) => ({ label: `S${index + 1}`, values: [index + 1, 1, 1] }));
    const chart = mountChart({ series: many });
    expect(chart.get('.ep-chart__group').findAll('.ep-chart__bar')).toHaveLength(6);
    expect(texts(chart, '.ep-chart__key')).toHaveLength(6);
  });

  it('draws a value below zero downwards from the zero line, and none where a value is missing', () => {
    const chart = mountChart({ series: [{ label: 'Cash', values: [-20, null, 60] }] });
    const drawn = bars(chart);
    expect(drawn).toHaveLength(2);
    expect([(drawn[0].element as HTMLElement).style.bottom, (drawn[0].element as HTMLElement).style.height]).toEqual(['0%', '25%']);
    expect(drawn[0].attributes('data-sign')).toBe('negative');
    expect([(drawn[1].element as HTMLElement).style.bottom, (drawn[1].element as HTMLElement).style.height]).toEqual(['25%', '75%']);
    expect(drawn[1].attributes('data-sign')).toBe('positive');
    expect(chart.findAll('.ep-chart__group')[1].findAll('.ep-chart__slot')).toHaveLength(1);
  });
});

describe('BarChart: what it says in words', () => {
  it('shows its description under the drawing, which a screen reader skips for the table of the same values', () => {
    const chart = mountChart({ series: [{ label: 'This week', values: [150, null, 75] }] });
    expect(chart.get('figcaption.ep-chart__caption').text()).toBe(WEEK.description);
    expect(chart.get('.ep-chart__plot').attributes('aria-hidden')).toBe('true');
    const table = chart.get('.ep-chart__table table');
    expect(table.get('caption').text()).toBe(WEEK.description);
    expect(texts(chart, 'thead th')).toEqual(['This week']);
    expect(chart.findAll('tbody tr').map((row) => [row.get('th').text(), ...row.findAll('td').map((cell) => cell.text())])).toEqual([
      ['Mon', '150'],
      ['Tue', '—'],
      ['Wed', '75'],
    ]);
  });

  it('writes the axis and the table with the page’s format, and numbers in the person’s language by default', () => {
    const money = mountChart({ format: (value) => `${value} €` });
    expect(texts(money, '.ep-chart__tick')).toEqual(['0 €', '100 €', '200 €', '300 €']);
    expect(money.findAll('tbody td').map((cell) => cell.text())).toEqual(['150 €', '300 €', '75 €']);
    const spanish = mount(BarChart, {
      props: { ...WEEK, series: [{ label: 'Kilos', values: [0.3, 0.8, 0.5] }] },
      global: { plugins: [createShellI18n({ locale: 'es' })] },
    });
    expect(texts(spanish, '.ep-chart__tick')).toEqual(['0', '0,2', '0,4', '0,6', '0,8']);
  });

  it('passes its test id to the figure', () => {
    expect(mountChart({ testid: 'sales-by-day' }).attributes('data-testid')).toBe('sales-by-day');
  });
});
