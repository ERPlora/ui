import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, ref, type Ref } from 'vue';

import { createShellI18n } from '../../shell/i18n';
import { fillLabel, useDataTableLabels } from './labels';
import en from './locales/en.json';
import es from './locales/es.json';
import type { DataTableLabels } from './types';

/** Mounts a probe that paints `text(key, params)` with the given overrides and plugins. */
function probe(
  key: keyof DataTableLabels,
  options: { labels?: Ref<Partial<DataTableLabels> | undefined>; params?: Record<string, number>; plugins?: unknown[] } = {},
) {
  const labels = options.labels ?? ref<Partial<DataTableLabels>>();
  const Probe = defineComponent({
    setup() {
      const { text } = useDataTableLabels(() => labels.value);
      return () => h('span', text(key, options.params));
    },
  });
  return mount(Probe, { global: { plugins: (options.plugins ?? []) as never[] } });
}

afterEach(() => {
  document.documentElement.lang = '';
});

describe('DataTable catalogues', () => {
  it('en and es carry the same keys, none empty', () => {
    expect(Object.keys(es.dataTable).sort()).toEqual(Object.keys(en.dataTable).sort());
    for (const tree of [en.dataTable, es.dataTable]) {
      for (const [key, value] of Object.entries(tree)) expect(value.trim(), key).not.toBe('');
    }
  });

  it('keep the texts of the Lit original (en source, es translation)', () => {
    expect(en.dataTable.showing).toBe('Showing {from}–{to} of');
    expect(es.dataTable.showing).toBe('Mostrando {from}–{to} de');
    expect(es.dataTable.loadError).toBe('No se han podido cargar los datos');
  });
});

describe('fillLabel', () => {
  it('fills the {tokens} it is given and leaves the others as written', () => {
    expect(fillLabel('Showing {from}–{to} of', { from: 11, to: 20 })).toBe('Showing 11–20 of');
    expect(fillLabel('{n} selected', {})).toBe('{n} selected');
    expect(fillLabel('Retry')).toBe('Retry');
  });
});

describe('useDataTableLabels', () => {
  it('without vue-i18n, speaks the language of the document (English by default)', () => {
    expect(probe('add').text()).toBe('Add');
    document.documentElement.lang = 'es-ES';
    expect(probe('add').text()).toBe('Añadir');
  });

  it("with the shell's vue-i18n, its locale wins over the document", () => {
    document.documentElement.lang = 'en';
    expect(probe('loadMore', { plugins: [createShellI18n({ locale: 'es' })] }).text()).toBe('Cargar más');
  });

  it('follows a change of locale at runtime', async () => {
    const i18n = createShellI18n({ locale: 'en' });
    const wrapper = probe('retry', { plugins: [i18n] });
    expect(wrapper.text()).toBe('Retry');
    i18n.global.locale.value = 'es';
    await nextTick();
    expect(wrapper.text()).toBe('Reintentar');
  });

  it('goes through t(): an app catalogue can reword a text for every table', () => {
    const i18n = createShellI18n({ locale: 'en', messages: { en: { dataTable: { add: 'Add item' } } } });
    expect(probe('add', { plugins: [i18n] }).text()).toBe('Add item');
  });

  it('fills {n}, {from} and {to} on every path (t(), bundled catalogue, override)', () => {
    const i18n = createShellI18n({ locale: 'en', messages: { en: { dataTable: { selected: '{n} picked' } } } });
    expect(probe('selected', { params: { n: 3 }, plugins: [i18n] }).text()).toBe('3 picked');
    expect(probe('selected', { params: { n: 3 } }).text()).toBe('3 selected');
    const labels = ref<Partial<DataTableLabels>>({ selected: '{n} marked' });
    expect(probe('selected', { params: { n: 3 }, labels }).text()).toBe('3 marked');
  });

  it('the `labels` prop wins, only for the keys it carries, and follows its changes', async () => {
    const labels = ref<Partial<DataTableLabels> | undefined>({ add: 'Add time slot' });
    const plugins = [createShellI18n({ locale: 'es' })];
    const add = probe('add', { labels, plugins });
    expect(add.text()).toBe('Add time slot');
    expect(probe('retry', { labels, plugins }).text()).toBe('Reintentar');
    labels.value = { add: 'Añadir franja' };
    await nextTick();
    expect(add.text()).toBe('Añadir franja');
  });
});
