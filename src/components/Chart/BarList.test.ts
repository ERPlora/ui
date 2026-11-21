// BarList — a ranked list of names, each with its value written out and a bar as long as its share of the largest:
// sales by channel, best-selling products. The names and values are the list a screen reader reads; the bars are
// only for the eye.
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import { createShellI18n } from '../../shell/i18n';
import * as components from '../index';
import BarList from './BarList.vue';
import * as entry from './index';
import type { BarListItem } from './types';

const CHANNELS: BarListItem[] = [
  { label: 'Dining room', value: 586, text: '586 €' },
  { label: 'Bar', value: 293, text: '293 €' },
  { label: 'Online', value: null, text: '—' },
];

type Props = InstanceType<typeof BarList>['$props'];

function mountList(props: Partial<Props> = {}) {
  return mount(BarList, {
    props: { items: CHANNELS, ...props } as Props,
    global: { plugins: [createShellI18n({ locale: 'en' })] },
  });
}

type List = ReturnType<typeof mountList>;

const rows = (list: List) =>
  list.findAll('li.ep-chart__row').map((row) => [row.get('.ep-chart__name').text(), row.get('.ep-chart__value').text()]);
const fills = (list: List) => list.findAll('.ep-chart__fill');

describe('BarList entry points', () => {
  it('is exported by its folder, by @erplora/ui/components and by the package root', () => {
    expect(entry.BarList).toBe(BarList);
    expect((components as Record<string, unknown>).BarList).toBe(BarList);
    expect((root as Record<string, unknown>).BarList).toBe(BarList);
  });
});

describe('BarList: the rows', () => {
  it('is a figure holding a list: each row its name, its value as the page wrote it and a bar for the eye', () => {
    const list = mountList();
    expect(list.element.tagName).toBe('FIGURE');
    expect(list.attributes('data-kind')).toBe('list');
    expect(list.find('ul.ep-chart__list').exists()).toBe(true);
    expect(rows(list)).toEqual([
      ['Dining room', '586 €'],
      ['Bar', '293 €'],
      ['Online', '—'],
    ]);
    expect(list.findAll('.ep-chart__track').every((track) => track.attributes('aria-hidden') === 'true')).toBe(true);
  });

  it('makes each bar as long as its share of the largest value, and draws none for a row without a value', () => {
    const list = mountList();
    expect(fills(list).map((fill) => (fill.element as HTMLElement).style.width)).toEqual(['100%', '50%']);
    expect(list.findAll('.ep-chart__row')[2].find('.ep-chart__fill').exists()).toBe(false);
  });

  it('paints its rows in series 1, in the list’s tone, or in a row’s own tone', () => {
    expect(fills(mountList()).map((fill) => fill.attributes('data-tone'))).toEqual(['1', '1']);
    const toned = mountList({ tone: 4, items: [CHANNELS[0], { ...CHANNELS[1], tone: 2 }] });
    expect(fills(toned).map((fill) => fill.attributes('data-tone'))).toEqual(['4', '2']);
  });

  it('measures a value below zero by its size and marks it negative', () => {
    const list = mountList({
      items: [
        { label: 'Morning drawer', value: 5.5, text: '5,50 €' },
        { label: 'Evening drawer', value: -11, text: '−11,00 €' },
      ],
    });
    expect(fills(list).map((fill) => [(fill.element as HTMLElement).style.width, fill.attributes('data-sign')])).toEqual([
      ['50%', 'positive'],
      ['100%', 'negative'],
    ]);
  });

  it('shows a description under it only when the page gives one', () => {
    expect(mountList().find('figcaption').exists()).toBe(false);
    expect(mountList({ description: 'Sales by channel today' }).get('figcaption').text()).toBe('Sales by channel today');
  });

  it('with every value at zero, it lists the rows with no bar longer than another', () => {
    const list = mountList({ items: [{ label: 'Bar', value: 0, text: '0 €' }] });
    expect(fills(list).map((fill) => (fill.element as HTMLElement).style.width)).toEqual(['0%']);
  });
});
