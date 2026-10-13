// Behaviour spec of UsageMeter: the labelled bar of the «Usage» card of a business (mockups
// `business.html`, Summary tab: «Almacenamiento · 12 %», the bar, a hint below). How full, in a
// tone that says whether to worry, with the percentage and the amount in the person's language,
// and a progress bar a screen reader can read.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as root from '../../index';
import { createShellI18n } from '../../shell/i18n';
import { componentCss, declaration } from '../__tests__/themeContrast';
import * as components from '../index';
import * as entry from './index';
import UsageMeter from './UsageMeter.vue';

const SFC = join(dirname(fileURLToPath(import.meta.url)), 'UsageMeter.vue');

type Props = InstanceType<typeof UsageMeter>['$props'];

const spaced = (text: string | undefined): string => (text ?? '').replace(/[  ]/g, ' ');

const mountMeter = (props: Props, options: { locale?: string; attrs?: Record<string, string> } = {}) =>
  mount(UsageMeter, {
    props,
    attrs: options.attrs,
    global: { plugins: options.locale ? [createShellI18n({ locale: options.locale })] : [] },
  });

afterEach(() => {
  document.documentElement.lang = '';
  vi.restoreAllMocks();
});

describe('UsageMeter', () => {
  it('paints the label, the percentage and a bar filled to it', () => {
    const wrapper = mountMeter({ label: 'Almacenamiento', value: 1.2, max: 10, unit: 'GB' }, { locale: 'es' });
    expect(wrapper.get('.usage-meter__label').text()).toBe('Almacenamiento');
    expect(spaced(wrapper.get('.usage-meter__percent').text())).toBe('12 %');
    expect((wrapper.get('.usage-meter__fill').element as HTMLElement).style.width).toBe('12%');
    expect(wrapper.attributes('data-size')).toBe('md');
  });

  it('shows the amount, «1,2 GB de 10 GB», in the person’s language', () => {
    const es = mountMeter({ label: 'Almacenamiento', value: 1.2, max: 10, unit: 'GB' }, { locale: 'es' });
    expect(spaced(es.get('.usage-meter__value').text())).toBe('1,2 GB de 10 GB');
    const en = mountMeter({ label: 'Storage', value: 1.2, max: 10, unit: 'GB' }, { locale: 'en' });
    expect(spaced(en.get('.usage-meter__value').text())).toBe('1.2 GB of 10 GB');
  });

  it('given only a percentage, shows the percentage and no amount', () => {
    const wrapper = mountMeter({ label: 'Storage', percent: 82 }, { locale: 'en' });
    expect(wrapper.get('.usage-meter__percent').text()).toBe('82%');
    expect(wrapper.find('.usage-meter__value').exists()).toBe(false);
  });

  it('the bar is a progress bar named by the label, from 0 to 100, with what it shows as its text', () => {
    const bar = mountMeter({ label: 'Almacenamiento', value: 1.2, max: 10, unit: 'GB' }, { locale: 'es' }).get(
      '[role="progressbar"]',
    );
    expect(bar.attributes('aria-label')).toBe('Almacenamiento');
    expect(bar.attributes('aria-valuemin')).toBe('0');
    expect(bar.attributes('aria-valuemax')).toBe('100');
    expect(bar.attributes('aria-valuenow')).toBe('12');
    expect(spaced(bar.attributes('aria-valuetext'))).toBe('1,2 GB de 10 GB (12 %)');
    const onlyPercent = mountMeter({ label: 'Storage', percent: 82 }, { locale: 'en' }).get('[role="progressbar"]');
    expect(onlyPercent.attributes('aria-valuetext')).toBe('82%');
  });

  it.each([
    [12, 'success'],
    [69, 'success'],
    [70, 'warning'],
    [82, 'warning'],
    [90, 'danger'],
    [97, 'danger'],
  ] as const)('at %s %% it is %s', (percent, tone) => {
    expect(mountMeter({ label: 'Storage', percent }).attributes('data-tone')).toBe(tone);
  });

  it('a tone given by the page wins', () => {
    expect(mountMeter({ label: 'Storage', percent: 10, tone: 'danger' }).attributes('data-tone')).toBe('danger');
  });

  it('over the limit: the text says how much (110 %), the bar stops full and the progress bar at 100', () => {
    const wrapper = mountMeter({ label: 'Storage', value: 11, max: 10, unit: 'GB' }, { locale: 'en' });
    expect(wrapper.get('.usage-meter__percent').text()).toBe('110%');
    expect((wrapper.get('.usage-meter__fill').element as HTMLElement).style.width).toBe('100%');
    expect(wrapper.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100');
    expect(wrapper.attributes('data-tone')).toBe('danger');
  });

  it('the hint goes below the bar and describes it', () => {
    const wrapper = mountMeter({ label: 'Storage', percent: 82, hint: 'You are running out of space.' });
    const hint = wrapper.get('.usage-meter__hint');
    expect(hint.text()).toBe('You are running out of space.');
    expect(hint.attributes('id')).toBeTruthy();
    expect(wrapper.get('[role="progressbar"]').attributes('aria-describedby')).toBe(hint.attributes('id'));
    const children = [...wrapper.element.children].map((el) => el.className);
    expect(children.indexOf('usage-meter__hint')).toBeGreaterThan(children.indexOf('usage-meter__track'));
  });

  it('no hint, nothing below and nothing describing the bar', () => {
    const wrapper = mountMeter({ label: 'Storage', percent: 12 });
    expect(wrapper.find('.usage-meter__hint').exists()).toBe(false);
    expect(wrapper.get('[role="progressbar"]').attributes('aria-describedby')).toBeUndefined();
  });

  it('comes in a small size, with a thinner bar', () => {
    expect(mountMeter({ label: 'Storage', percent: 12, size: 'sm' }).attributes('data-size')).toBe('sm');
    const css = componentCss(SFC);
    const height = (selector: string) => Number.parseFloat(declaration(css, selector, '--usage-meter-height') ?? 'NaN');
    expect(height(".usage-meter[data-size='sm']")).toBeLessThan(height('.usage-meter'));
  });

  it('a locale the page passes wins over the app’s', () => {
    const wrapper = mountMeter({ label: 'Storage', value: 1.2, max: 10, unit: 'GB', locale: 'en' }, { locale: 'es' });
    expect(spaced(wrapper.get('.usage-meter__value').text())).toBe('1.2 GB of 10 GB');
  });

  it('without vue-i18n, the language of the page; without it, the browser’s', () => {
    document.documentElement.lang = 'es-ES';
    expect(spaced(mountMeter({ label: 'x', value: 1.2, max: 10 }).get('.usage-meter__value').text())).toBe('1,2 de 10');
    document.documentElement.lang = '';
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
    expect(mountMeter({ label: 'x', value: 1.2, max: 10 }).get('.usage-meter__value').text()).toBe('1.2 of 10');
  });

  it('passes attributes through (a test hook)', () => {
    const wrapper = mountMeter({ label: 'Storage', percent: 12 }, { attrs: { 'data-testid': 'usage-storage' } });
    expect(wrapper.attributes('data-testid')).toBe('usage-storage');
  });

  it('is our own component, without OutfitKit', () => {
    expect(componentCss(SFC)).not.toMatch(/--ok-|ok-[a-z]/);
  });

  it('is exported from its folder, from `@erplora/ui/components` and from the package root', () => {
    expect(entry.UsageMeter).toBe(UsageMeter);
    expect((components as Record<string, unknown>).UsageMeter).toBe(UsageMeter);
    expect((root as Record<string, unknown>).UsageMeter).toBe(UsageMeter);
    for (const name of ['usagePercent', 'usageTone', 'formatUsageValue', 'formatUsagePercent']) {
      expect(typeof (components as Record<string, unknown>)[name], name).toBe('function');
    }
  });
});
