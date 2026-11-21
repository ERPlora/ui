// LineChart — values per label as lines on a round scale from zero, in the colours of data: the first series with a
// light shade down to zero, each further one with its own dash as well as its colour, and a legend that names them.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import { createShellI18n } from '../../shell/i18n';
import * as components from '../index';
import * as entry from './index';
import LineChart from './LineChart.vue';
import type { ChartProps } from './types';

const HOURS: ChartProps = {
  labels: ['08:00', '12:00', '16:00', '20:00'],
  series: [{ label: 'Today', values: [0, 100, 200, 300] }],
  description: 'Sales by hour: from 0 at eight to 300 at eight in the evening.',
};

function mountChart(props: Partial<ChartProps> = {}) {
  return mount(LineChart, { props: { ...HOURS, ...props }, global: { plugins: [createShellI18n({ locale: 'en' })] } });
}

describe('LineChart entry points', () => {
  it('is exported by its folder, by @erplora/ui/components and by the package root', () => {
    expect(entry.LineChart).toBe(LineChart);
    expect((components as Record<string, unknown>).LineChart).toBe(LineChart);
    expect((root as Record<string, unknown>).LineChart).toBe(LineChart);
  });
});

describe('LineChart: the lines', () => {
  it('draws each value over the middle of its label, the top of the round scale at the top of the plot', () => {
    const chart = mountChart();
    expect(chart.element.tagName).toBe('FIGURE');
    expect(chart.attributes('data-kind')).toBe('line');
    expect(chart.findAll('.ep-chart__label').map((label) => label.text())).toEqual(HOURS.labels);
    expect(chart.findAll('.ep-chart__tick').map((tick) => tick.text())).toEqual(['0', '100', '200', '300']);
    const svg = chart.get('svg.ep-chart__lines');
    expect(svg.attributes('viewBox')).toBe('0 0 100 100');
    expect(svg.attributes('preserveAspectRatio')).toBe('none');
    const line = svg.get('polyline.ep-chart__line');
    expect(line.attributes('points')).toBe('12.5,100 37.5,66.67 62.5,33.33 87.5,0');
    expect(line.attributes('vector-effect')).toBe('non-scaling-stroke');
    expect([line.attributes('data-tone'), line.attributes('data-pattern')]).toEqual(['1', 'solid']);
  });

  it('shades the first series down to the zero line', () => {
    const shade = mountChart({ series: [{ label: 'Cash', values: [-20, 60] }] }).get('polygon.ep-chart__shade');
    expect(shade.attributes('points')).toBe('25,100 75,0 75,75 25,75');
    expect(shade.attributes('data-tone')).toBe('1');
  });

  it('gives each further series its own dash and colour, unshaded, and names them all in a legend', () => {
    const chart = mountChart({
      series: [
        { label: 'Today', values: [0, 100, 200, 300] },
        { label: 'Last Tuesday', values: [0, 80, 150, 205] },
        { label: 'Target', values: [50, 100, 150, 200], tone: 6 },
      ],
    });
    expect(chart.findAll('.ep-chart__line').map((line) => [line.attributes('data-tone'), line.attributes('data-pattern')])).toEqual([
      ['1', 'solid'],
      ['2', 'dashed'],
      ['6', 'dotted'],
    ]);
    expect(chart.findAll('.ep-chart__shade')).toHaveLength(1);
    expect(chart.findAll('.ep-chart__key').map((key) => key.text())).toEqual(['Today', 'Last Tuesday', 'Target']);
    expect(chart.findAll('.ep-chart__swatch').map((swatch) => swatch.attributes('data-mark'))).toEqual(['line', 'line', 'line']);
  });

  it('has no legend for a single series: the description names it', () => {
    expect(mountChart().find('.ep-chart__legend').exists()).toBe(false);
  });

  it('breaks the line where a value is missing', () => {
    const chart = mountChart({ series: [{ label: 'Today', values: [0, 100, null, 300] }] });
    expect(chart.findAll('.ep-chart__line').map((line) => line.attributes('points'))).toEqual(['12.5,100 37.5,66.67']);
  });

  it('draws a value with no neighbour as a dot in its series’ colour and shape: the first hour of the day', () => {
    const chart = mountChart({
      series: [
        { label: 'Today', values: [120, null, null, null] },
        { label: 'Last Tuesday', values: [30, 60, null, 90] },
      ],
    });
    const dots = chart.findAll('.ep-chart__dot');
    expect(dots.map((dot) => [dot.attributes('data-tone'), dot.attributes('data-pattern')])).toEqual([
      ['1', 'solid'],
      ['2', 'dashed'],
    ]);
    expect(dots.map((dot) => [(dot.element as HTMLElement).style.left, (dot.element as HTMLElement).style.top])).toEqual([
      ['12.5%', '20%'],
      ['87.5%', '40%'],
    ]);
    expect(chart.findAll('.ep-chart__line').map((line) => line.attributes('data-tone'))).toEqual(['2']);
    expect(chart.find('.ep-chart__shade').exists()).toBe(false);
  });

  it('keeps its description on screen and the table of its values for a screen reader', () => {
    const chart = mountChart();
    expect(chart.get('figcaption').text()).toBe(HOURS.description);
    expect(chart.get('.ep-chart__plot').attributes('aria-hidden')).toBe('true');
    expect(chart.findAll('tbody tr').map((row) => [row.get('th').text(), row.get('td').text()])).toEqual([
      ['08:00', '0'],
      ['12:00', '100'],
      ['16:00', '200'],
      ['20:00', '300'],
    ]);
  });
});
