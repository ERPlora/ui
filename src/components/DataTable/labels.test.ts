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

  it('a text with singular and plural forms carries the same forms in both languages', () => {
    const es_ = es.dataTable as Record<string, string>;
    for (const [key, value] of Object.entries(en.dataTable)) {
      expect(es_[key].split('|').length, key).toBe(value.split('|').length);
    }
    expect(es.dataTable.selected.split('|').length).toBe(2);
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

  it('picks the form of a `|` text by {n}, as vue-i18n does (two forms: one | the rest; three: none | one | more)', () => {
    expect(fillLabel('{n} fila | {n} filas', { n: 1 })).toBe('1 fila');
    expect(fillLabel('{n} fila | {n} filas', { n: 3 })).toBe('3 filas');
    expect(fillLabel('{n} fila | {n} filas', { n: 0 })).toBe('0 filas');
    expect(fillLabel('ninguna | una fila | {n} filas', { n: 0 })).toBe('ninguna');
    expect(fillLabel('ninguna | una fila | {n} filas', { n: 1 })).toBe('una fila');
    expect(fillLabel('ninguna | una fila | {n} filas', { n: 7 })).toBe('7 filas');
  });

  it("picks the same form as vue-i18n's t() for any count, and without one", () => {
    const texts = { two: '{n} fila | {n} filas', three: 'ninguna | una fila | {n} filas', bare: 'una | varias' };
    const { t } = createShellI18n({ locale: 'es', messages: { es: { probe: texts } } }).global;
    for (const [key, text] of Object.entries(texts)) {
      for (const n of [0, 1, 2, 3, 12]) expect(fillLabel(text, { n }), `${key}, n=${n}`).toBe(t(`probe.${key}`, { n }));
    }
    expect(fillLabel(texts.bare)).toBe(t('probe.bare'));
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

  it('the selection count: one row in the singular, more in the plural, in en and es, on every path', () => {
    const count = (n: number, options: Parameters<typeof probe>[1] = {}) =>
      probe('selected', { ...options, params: { n } }).text();
    const spanish = [createShellI18n({ locale: 'es' })];
    expect(count(1, { plugins: spanish })).toBe('1 seleccionado');
    expect(count(3, { plugins: spanish })).toBe('3 seleccionados');
    const english = [createShellI18n({ locale: 'en' })];
    expect(count(1, { plugins: english })).toBe('1 selected');
    expect(count(3, { plugins: english })).toBe('3 selected');
    document.documentElement.lang = 'es';
    expect(count(1)).toBe('1 seleccionado');
    expect(count(2)).toBe('2 seleccionados');
    const labels = ref<Partial<DataTableLabels>>({ selected: '{n} fila marcada | {n} filas marcadas' });
    expect(count(1, { labels })).toBe('1 fila marcada');
    expect(count(2, { labels })).toBe('2 filas marcadas');
    const app = [createShellI18n({ locale: 'es', messages: { es: { dataTable: { selected: '{n} elegido | {n} elegidos' } } } })];
    expect(count(1, { plugins: app })).toBe('1 elegido');
    expect(count(2, { plugins: app })).toBe('2 elegidos');
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
