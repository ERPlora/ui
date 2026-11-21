import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';

import * as root from '../../index';
import { createShellI18n } from '../../shell/i18n';
import { componentCss, declaration } from '../__tests__/themeContrast';
import * as components from '../index';
import AllergenRow from './AllergenRow.vue';
import * as entry from './index';

const css = componentCss(join(dirname(fileURLToPath(import.meta.url)), 'AllergenRow.vue'));

function row(props: { codes: readonly string[]; name?: string }, locale: 'en' | 'es' = 'en') {
  const i18n = createShellI18n({ locale });
  const wrapper = mount(AllergenRow, {
    props: { testid: 'allergens', ...props },
    global: { plugins: [i18n] },
  });
  return { wrapper, i18n, line: () => wrapper.find('[data-testid="allergens"]') };
}

describe('AllergenRow', () => {
  it('names the allergens in list order, whatever order the codes come in', () => {
    const { line } = row({ codes: ['milk', 'gluten', 'celery'] });

    expect(line().text()).toBe('Allergens: Gluten, Milk, Celery');
  });

  it('speaks the business language, the label and every name', () => {
    const { line } = row({ codes: ['tree_nuts', 'milk'] }, 'es');

    expect(line().text()).toBe('Alérgenos: Leche, Frutos de cáscara');
  });

  it('follows a change of language without being mounted again', async () => {
    const { line, i18n } = row({ codes: ['egg'] });
    expect(line().text()).toBe('Allergens: Egg');

    i18n.global.locale.value = 'es';
    await nextTick();

    expect(line().text()).toBe('Alérgenos: Huevo');
  });

  it('puts the name of what it describes before the allergens', () => {
    const { line } = row({ codes: ['fish'], name: 'Paella' });

    expect(line().text()).toBe('Paella · Allergens: Fish');
  });

  it('renders nothing at all without allergens', () => {
    const { wrapper, line } = row({ codes: [], name: 'Paella' });

    expect(line().exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  it('renders nothing when none of the codes is one of the fourteen', () => {
    const { line } = row({ codes: ['shellfish'] });

    expect(line().exists()).toBe(false);
  });

  it('is a block of secondary text that can sit inside a label', () => {
    const { line } = row({ codes: ['soy'] });

    expect(line().element.tagName).toBe('SPAN');
    expect(line().classes()).toContain('allergen-row');
    expect(declaration(css, '.allergen-row', 'display')).toBe('block');
  });

  it('breaks a word longer than the row instead of widening it', () => {
    expect(declaration(css, '.allergen-row', 'overflow-wrap')).toBe('anywhere');
  });

  it('updates when the codes change', async () => {
    const { wrapper, line } = row({ codes: ['soy'] });
    await wrapper.setProps({ codes: ['soy', 'sesame'] });

    expect(line().text()).toBe('Allergens: Soy, Sesame');

    await wrapper.setProps({ codes: [] });
    expect(line().exists()).toBe(false);
  });

  it('is exported from its folder, the components barrel and the package root', () => {
    expect(entry.AllergenRow).toBe(AllergenRow);
    expect(components.AllergenRow).toBe(AllergenRow);
    expect(root.AllergenRow).toBe(AllergenRow);
  });
});
