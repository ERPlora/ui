// Behaviour spec of UsageCounter: the small figure next to the UsageMeter in the «Usage» card of a
// business (mockups `business.html`: «Activos ayer 3», «Últimos 30 días 4»): a label, a big number
// in the person's language and an optional hint.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import * as root from '../../index';
import { createShellI18n } from '../../shell/i18n';
import { componentCss } from '../__tests__/themeContrast';
import * as components from '../index';
import * as entry from './index';
import UsageCounter from './UsageCounter.vue';

const SFC = join(dirname(fileURLToPath(import.meta.url)), 'UsageCounter.vue');

type Props = InstanceType<typeof UsageCounter>['$props'];

const mountCounter = (props: Props, options: { locale?: string; attrs?: Record<string, string> } = {}) =>
  mount(UsageCounter, {
    props,
    attrs: options.attrs,
    global: { plugins: options.locale ? [createShellI18n({ locale: options.locale })] : [] },
  });

afterEach(() => {
  document.documentElement.lang = '';
});

describe('UsageCounter', () => {
  it('paints the label over a big number', () => {
    const wrapper = mountCounter({ label: 'Activos ayer', value: 3 });
    expect(wrapper.classes()).toContain('usage-counter');
    expect(wrapper.get('.usage-counter__label').text()).toBe('Activos ayer');
    expect(wrapper.get('.usage-counter__value').text()).toBe('3');
    const children = [...wrapper.element.children].map((el) => el.className);
    expect(children).toEqual(['usage-counter__label', 'usage-counter__value']);
  });

  it('formats a number in the person’s language', () => {
    expect(mountCounter({ label: 'x', value: 12500 }, { locale: 'es' }).get('.usage-counter__value').text()).toBe('12.500');
    expect(mountCounter({ label: 'x', value: 12500 }, { locale: 'en' }).get('.usage-counter__value').text()).toBe('12,500');
    expect(
      mountCounter({ label: 'x', value: 12500, locale: 'en' }, { locale: 'es' }).get('.usage-counter__value').text(),
    ).toBe('12,500');
  });

  it('a text value is shown as it comes («—», «4 / 10»)', () => {
    expect(mountCounter({ label: 'x', value: '4 / 10' }).get('.usage-counter__value').text()).toBe('4 / 10');
  });

  it('an optional hint goes below the number', () => {
    const wrapper = mountCounter({ label: 'Últimos 30 días', value: 4, hint: 'Personas distintas' });
    expect(wrapper.get('.usage-counter__hint').text()).toBe('Personas distintas');
    expect(mountCounter({ label: 'x', value: 4 }).find('.usage-counter__hint').exists()).toBe(false);
  });

  it('passes attributes through (a test hook)', () => {
    expect(mountCounter({ label: 'x', value: 1 }, { attrs: { 'data-testid': 'active-1d' } }).attributes('data-testid')).toBe(
      'active-1d',
    );
  });

  it('is our own component, without OutfitKit', () => {
    expect(componentCss(SFC)).not.toMatch(/--ok-|ok-[a-z]/);
  });

  it('is exported from its folder, from `@erplora/ui/components` and from the package root', () => {
    expect(entry.UsageCounter).toBe(UsageCounter);
    expect((components as Record<string, unknown>).UsageCounter).toBe(UsageCounter);
    expect((root as Record<string, unknown>).UsageCounter).toBe(UsageCounter);
  });
});
