// StatCard — the figure card: a label, a big value, its icon, an optional note and trend, in one of the six data tones
// and in a lively (gradient) or soft (surface) variant. With a destination the whole card is one link; it also paints
// its loading, empty and error states, and the error keeps its own action. A status goes apart, in a StatusPill.
import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

import { createShellI18n } from '../../shell/i18n';
import HubIcon from '../../shell/HubIcon.vue';
import * as root from '../../index';
import * as components from '../index';
import StatusPill from '../StatusPill/StatusPill.vue';
import * as entry from './index';
import StatCard from './StatCard.vue';

type Props = InstanceType<typeof StatCard>['$props'];

const SALES: Props = { label: 'Sales today', value: '1,284.60 €', icon: 'ion:wallet-outline' };

function makeRouter(): Router {
  const page = { template: '<div />' };
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: page },
      { path: '/sales', component: page },
    ],
  });
}

async function mountCard(props: Partial<Props> = {}, locale = 'en') {
  const router = makeRouter();
  await router.push('/');
  await router.isReady();
  const wrapper = mount(StatCard, {
    props: { ...SALES, ...props } as Props,
    attachTo: document.body,
    global: { plugins: [createShellI18n({ locale }), router] },
  });
  await flushPromises();
  return { wrapper, router };
}

type Card = Awaited<ReturnType<typeof mountCard>>['wrapper'];

const iconNames = (wrapper: Card): string[] => wrapper.findAllComponents(HubIcon).map((icon) => icon.props('name'));
const focusables = (wrapper: Card): Element[] => [
  ...wrapper.element.querySelectorAll('a, button, ion-button, [tabindex], input, select, textarea'),
];

describe('StatCard entry points', () => {
  it('is exported by its folder, by @erplora/ui/components and by the package root', () => {
    expect(entry.StatCard).toBe(StatCard);
    expect((components as Record<string, unknown>).StatCard).toBe(StatCard);
    expect((root as Record<string, unknown>).StatCard).toBe(StatCard);
  });
});

describe('StatCard: the figure', () => {
  it('paints its icon, label, note and value on an opaque surface, soft and in series 1 by default', async () => {
    const { wrapper } = await mountCard({ note: 'Today, up to 20:00' });
    expect(wrapper.element.tagName).toBe('ARTICLE');
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['ep-stat-card', 'ep-surface', 'ep-stat-card--soft']));
    expect(wrapper.classes()).not.toContain('ep-glass');
    expect(wrapper.attributes('data-tone')).toBe('1');
    expect(wrapper.attributes('data-state')).toBe('ready');
    expect(wrapper.get('.ep-stat-card__label').text()).toBe('Sales today');
    expect(wrapper.get('.ep-stat-card__note').text()).toBe('Today, up to 20:00');
    expect(wrapper.get('.ep-stat-card__value').text()).toBe('1,284.60 €');
    expect(iconNames(wrapper)).toEqual(['ion:wallet-outline']);
    expect(wrapper.find('.ep-stat-card__trend').exists()).toBe(false);
  });

  it('paints the lively variant and any of the six data tones', async () => {
    const { wrapper } = await mountCard({ variant: 'live', tone: 4 });
    expect(wrapper.classes()).toContain('ep-stat-card--live');
    expect(wrapper.classes()).not.toContain('ep-stat-card--soft');
    expect(wrapper.attributes('data-tone')).toBe('4');
  });

  it.each([
    ['up', undefined, 'ion:trending-up-outline', 'Up', 'success'],
    ['down', undefined, 'ion:trending-down-outline', 'Down', 'danger'],
    ['flat', undefined, 'ion:remove-outline', 'No change', 'neutral'],
    ['up', 'danger', 'ion:trending-up-outline', 'Up', 'danger'],
  ] as const)('a trend %s (tone %s) shows its icon, named for a screen reader, and its text', async (direction, tone, icon, name, shown) => {
    const { wrapper } = await mountCard({ trend: { direction, label: '12.4 % more than last Tuesday', tone } });
    const trend = wrapper.get('.ep-stat-card__trend');
    expect(trend.text()).toBe('12.4 % more than last Tuesday');
    expect(trend.get('.ep-stat-card__text').text()).toBe('12.4 % more than last Tuesday');
    expect(trend.attributes('data-trend')).toBe(shown);
    const glyph = trend.findComponent(HubIcon);
    expect(glyph.props('name')).toBe(icon);
    expect(glyph.props('label')).toBe(name);
  });

  it('names the trend in Spanish', async () => {
    const { wrapper } = await mountCard({ trend: { direction: 'down', label: '3 menos' } }, 'es');
    expect(wrapper.get('.ep-stat-card__trend').findComponent(HubIcon).props('label')).toBe('Baja');
  });
});

describe('StatCard: a destination makes the whole card one link', () => {
  it('the card itself is the link, with nothing else to focus inside', async () => {
    const { wrapper } = await mountCard({ to: '/sales', variant: 'live' });
    expect(wrapper.element.tagName).toBe('A');
    expect(wrapper.attributes('href')).toBe('/sales');
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['ep-stat-card', 'ep-stat-card--link']));
    expect(focusables(wrapper)).toEqual([]);
    expect(iconNames(wrapper)).toContain('ion:chevron-forward-outline');
  });

  it('a tap anywhere on it, the value included, opens the destination', async () => {
    const { wrapper, router } = await mountCard({ to: '/sales' });
    await wrapper.get('.ep-stat-card__value').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/sales');
  });

  it('without a destination it is not a link and shows no arrow', async () => {
    const { wrapper } = await mountCard();
    expect(wrapper.element.tagName).toBe('ARTICLE');
    expect(wrapper.classes()).not.toContain('ep-stat-card--link');
    expect(iconNames(wrapper)).not.toContain('ion:chevron-forward-outline');
  });
});

describe('StatCard: loading, empty and error', () => {
  it('while loading it is busy, named for a screen reader, shows placeholders and opens nothing', async () => {
    const { wrapper } = await mountCard({ loading: true, to: '/sales', variant: 'live' });
    expect(wrapper.element.tagName).toBe('ARTICLE');
    expect(wrapper.attributes('aria-busy')).toBe('true');
    expect(wrapper.attributes('aria-label')).toBe('Loading Sales today');
    expect(wrapper.attributes('data-state')).toBe('loading');
    expect(wrapper.classes()).toContain('ep-stat-card--soft');
    expect(wrapper.findAll('ion-skeleton-text.ep-stat-card__bone').length).toBeGreaterThanOrEqual(3);
    expect(wrapper.find('.ep-stat-card__value').exists()).toBe(false);
  });

  it('says it is loading in Spanish', async () => {
    const { wrapper } = await mountCard({ loading: true, label: 'Ventas de hoy' }, 'es');
    expect(wrapper.attributes('aria-label')).toBe('Cargando Ventas de hoy');
  });

  it.each([null, undefined, '', '  '])('with no value (%j) it says there is no data, and keeps its destination', async (value) => {
    const { wrapper } = await mountCard({ value, to: '/sales', trend: { direction: 'up', label: 'more' } });
    expect(wrapper.attributes('data-state')).toBe('empty');
    expect(wrapper.element.tagName).toBe('A');
    expect(wrapper.get('.ep-stat-card__value').text()).toBe('—');
    expect(wrapper.get('.ep-stat-card__value').attributes('aria-hidden')).toBe('true');
    expect(wrapper.get('.ep-stat-card__empty').text()).toBe('No data for this period');
    expect(wrapper.find('.ep-stat-card__trend').exists()).toBe(false);
  });

  it('with no value a lively card keeps the surface, where its muted text reads', async () => {
    const { wrapper } = await mountCard({ value: null, variant: 'live' });
    expect(wrapper.classes()).toContain('ep-stat-card--soft');
    expect(wrapper.classes()).not.toContain('ep-stat-card--live');
  });

  it('the empty text can be the page’s own, and it is translated by default', async () => {
    expect((await mountCard({ value: null, emptyLabel: 'No sales yet' })).wrapper.get('.ep-stat-card__empty').text()).toBe(
      'No sales yet',
    );
    expect((await mountCard({ value: null }, 'es')).wrapper.get('.ep-stat-card__empty').text()).toBe(
      'No hay datos en este periodo',
    );
  });

  it('on error it says so on the soft surface and keeps its own action, Retry, which asks the page to load again', async () => {
    const { wrapper } = await mountCard({ error: true, to: '/sales', variant: 'live' });
    expect(wrapper.attributes('data-state')).toBe('error');
    expect(wrapper.element.tagName).toBe('ARTICLE');
    expect(wrapper.classes()).toContain('ep-stat-card--soft');
    const error = wrapper.get('.ep-stat-card__error');
    expect(error.attributes('role')).toBe('status');
    expect(error.get('.ep-stat-card__text').text()).toBe("Couldn't load");
    const retry = wrapper.get('ion-button.ep-stat-card__retry');
    expect(retry.text()).toBe('Retry');
    expect(focusables(wrapper)).toEqual([retry.element]);
    expect(iconNames(wrapper)).not.toContain('ion:chevron-forward-outline');
    await retry.trigger('click');
    expect(wrapper.emitted('retry')).toEqual([[]]);
  });

  it('says the error and its action in Spanish', async () => {
    const { wrapper } = await mountCard({ error: true }, 'es');
    expect(wrapper.get('.ep-stat-card__error').text()).toContain('No se pudo cargar');
    expect(wrapper.get('ion-button.ep-stat-card__retry').text()).toBe('Reintentar');
  });

  it('loading wins over error, and error over an empty value', async () => {
    expect((await mountCard({ loading: true, error: true })).wrapper.attributes('data-state')).toBe('loading');
    expect((await mountCard({ error: true, value: null })).wrapper.attributes('data-state')).toBe('error');
  });

  it('passes its test id to the card', async () => {
    const { wrapper } = await mountCard({ testid: 'home-sales' });
    expect(wrapper.attributes('data-testid')).toBe('home-sales');
  });
});

describe('StatCard: the sparkline', () => {
  it('draws the trend of its figure under it as one line, hidden from a screen reader that reads the figure', async () => {
    const { wrapper } = await mountCard({ sparkline: [5, 15, 10] });
    const spark = wrapper.get('svg.ep-stat-card__spark');
    expect(spark.attributes('aria-hidden')).toBe('true');
    expect(spark.attributes('preserveAspectRatio')).toBe('none');
    const line = spark.get('polyline');
    expect(line.attributes('points')).toBe('0,30 50,2 100,16');
    expect(line.attributes('vector-effect')).toBe('non-scaling-stroke');
    expect(wrapper.element.lastElementChild).toBe(spark.element);
  });

  it('draws it on the lively card too, after the trend', async () => {
    const { wrapper } = await mountCard({
      variant: 'live',
      sparkline: [1, 2],
      trend: { direction: 'up', label: '12.4 % more' },
    });
    const parts = [...wrapper.element.children].map((part) => part.getAttribute('class'));
    expect(parts.slice(-2)).toEqual(['ep-stat-card__meta ep-stat-card__trend', 'ep-stat-card__spark']);
  });

  it.each([
    ['loading', { loading: true }],
    ['empty', { value: null }],
    ['error', { error: true }],
    ['without values', { sparkline: [] }],
  ])('draws none %s', async (_state, props) => {
    const { wrapper } = await mountCard({ sparkline: [5, 15, 10], ...props });
    expect(wrapper.find('.ep-stat-card__spark').exists()).toBe(false);
  });
});

describe('StatCard: a status apart from the figure', () => {
  const SOLD_OUT = { tone: 'danger', label: 'Sold out' } as const;

  it('paints the status as a pill of its own tone, with icon and words, in the bottom row in place of the trend', async () => {
    const { wrapper } = await mountCard({ tone: 6, status: SOLD_OUT, trend: { direction: 'up', label: '3 more' } });
    const row = wrapper.get('.ep-stat-card__status');
    expect(row.classes()).toContain('ep-stat-card__meta');
    const pill = row.getComponent(StatusPill);
    expect(pill.props()).toMatchObject({ tone: 'danger', label: 'Sold out', icon: 'ion:alert-circle-outline' });
    expect(row.text()).toBe('Sold out');
    expect(wrapper.find('.ep-stat-card__trend').exists()).toBe(false);
  });

  it('leaves the colour of the figure alone: the card keeps its data tone and its variant', async () => {
    const soft = (await mountCard({ tone: 6, status: SOLD_OUT })).wrapper;
    expect(soft.attributes('data-tone')).toBe('6');
    expect(soft.classes()).toContain('ep-stat-card--soft');
    const live = (await mountCard({ tone: 1, variant: 'live', status: { tone: 'warning', label: 'Mismatch' } })).wrapper;
    expect(live.attributes('data-tone')).toBe('1');
    expect(live.classes()).toContain('ep-stat-card--live');
    expect(live.getComponent(StatusPill).props('tone')).toBe('warning');
  });

  it.each([
    ['success', 'ion:checkmark-circle-outline'],
    ['warning', 'ion:warning-outline'],
    ['danger', 'ion:alert-circle-outline'],
  ] as const)('a %s status has its own icon, so the colour is never the only sign', async (tone, icon) => {
    const { wrapper } = await mountCard({ status: { tone, label: 'x' } });
    expect(wrapper.getComponent(StatusPill).props('icon')).toBe(icon);
  });

  it('keeps the sparkline under the status', async () => {
    const { wrapper } = await mountCard({ status: SOLD_OUT, sparkline: [3, 1, 0] });
    const parts = [...wrapper.element.children].map((part) => part.getAttribute('class'));
    expect(parts.slice(-2)).toEqual(['ep-stat-card__meta ep-stat-card__status', 'ep-stat-card__spark']);
  });

  it.each([
    ['loading', { loading: true }],
    ['empty', { value: null }],
    ['error', { error: true }],
  ])('shows no status while %s: the figure it speaks of is not there', async (_state, props) => {
    const { wrapper } = await mountCard({ status: SOLD_OUT, ...props });
    expect(wrapper.findComponent(StatusPill).exists()).toBe(false);
    expect(wrapper.find('.ep-stat-card__status').exists()).toBe(false);
  });
});
