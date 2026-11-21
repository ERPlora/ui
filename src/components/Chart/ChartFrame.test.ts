// The three charts share their states: while loading they are busy and show a placeholder, with no data they say so
// (in the page's words if it gives them), and on error they say so and keep their own action, Retry.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Component } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import BarChart from './BarChart.vue';
import BarList from './BarList.vue';
import LineChart from './LineChart.vue';

const PLOT = { labels: ['Mon', 'Tue'], series: [{ label: 'Sales', values: [10, 20] }], description: 'Sales by day' };
const NO_VALUES = { ...PLOT, series: [{ label: 'Sales', values: [null, null] }] };

const CHARTS: [string, Component, Record<string, unknown>, Record<string, unknown>][] = [
  ['BarChart', BarChart, PLOT, NO_VALUES],
  ['LineChart', LineChart, PLOT, NO_VALUES],
  ['BarList', BarList, { items: [{ label: 'Bar', value: 3, text: '3' }] }, { items: [] }],
];

function mountChart(chart: Component, props: Record<string, unknown>, locale = 'en') {
  return mount(chart, { props, global: { plugins: [createShellI18n({ locale })] } });
}

describe.each(CHARTS)('%s: loading, empty and error', (_name, chart, ready, empty) => {
  it('while loading it is busy, named for a screen reader, and shows a placeholder instead of the drawing', () => {
    const wrapper = mountChart(chart, { ...ready, loading: true });
    expect(wrapper.attributes('data-state')).toBe('loading');
    expect(wrapper.attributes('aria-busy')).toBe('true');
    expect(wrapper.attributes('aria-label')).toBe('Loading the chart');
    expect(wrapper.find('.ep-chart__bone').exists()).toBe(true);
    expect(wrapper.find('.ep-chart__plot, .ep-chart__list, figcaption').exists()).toBe(false);
    expect(mountChart(chart, { ...ready, loading: true }, 'es').attributes('aria-label')).toBe('Cargando el gráfico');
  });

  it('with nothing to draw it says there is no data, in the page’s words if it gives them', () => {
    const wrapper = mountChart(chart, empty);
    expect(wrapper.attributes('data-state')).toBe('empty');
    expect(wrapper.get('.ep-chart__empty').text()).toBe('No data for this period');
    expect(wrapper.find('.ep-chart__plot, .ep-chart__list').exists()).toBe(false);
    expect(mountChart(chart, { ...empty, emptyLabel: 'No sales yet today' }).get('.ep-chart__empty').text()).toBe('No sales yet today');
    expect(mountChart(chart, empty, 'es').get('.ep-chart__empty').text()).toBe('No hay datos en este periodo');
  });

  it('on error it says so and keeps its own action, Retry, which asks the page to load again', async () => {
    const wrapper = mountChart(chart, { ...ready, error: true });
    expect(wrapper.attributes('data-state')).toBe('error');
    expect(wrapper.get('.ep-chart__error').text()).toContain("Couldn't load the chart");
    expect(wrapper.find('.ep-chart__plot, .ep-chart__list').exists()).toBe(false);
    const retry = wrapper.get('.ep-chart__retry');
    expect(retry.text()).toBe('Retry');
    await retry.trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
    const spanish = mountChart(chart, { ...ready, error: true }, 'es');
    expect(spanish.get('.ep-chart__error').text()).toContain('No se pudo cargar el gráfico');
    expect(spanish.get('.ep-chart__retry').text()).toBe('Reintentar');
  });

  it('loading wins over error, and error over no data', () => {
    expect(mountChart(chart, { ...empty, loading: true, error: true }).attributes('data-state')).toBe('loading');
    expect(mountChart(chart, { ...empty, error: true }).attributes('data-state')).toBe('error');
  });
});

describe('the bar and the line chart with no labels', () => {
  it.each([BarChart, LineChart])('say there is no data', (chart) => {
    expect(mountChart(chart, { ...PLOT, labels: [] }).attributes('data-state')).toBe('empty');
    expect(mountChart(chart, { ...PLOT, series: [] }).attributes('data-state')).toBe('empty');
  });
});
