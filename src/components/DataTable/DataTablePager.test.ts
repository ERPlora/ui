import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { createShellI18n } from '../../shell/i18n';
import DataTablePager from './DataTablePager.vue';
import type { PagerState } from './model';

const desk = (current: number, pages = 6): PagerState<unknown> => ({
  visible: [],
  pages,
  current,
  count: pages * 10 - 4,
  rangeFrom: current * 10 + 1,
  rangeTo: Math.min((current + 1) * 10, pages * 10 - 4),
  canLoadMore: false,
});

function mountPager(props: Record<string, unknown> = {}, locale: 'en' | 'es' = 'en') {
  return mount(DataTablePager, {
    props: {
      pager: desk(0),
      windowed: false,
      phonePaged: false,
      awaitingRows: false,
      sizeSelect: false,
      pageSize: 10,
      pageSizeOptions: [10, 25],
      testid: 'apps',
      ...props,
    },
    global: { plugins: [createShellI18n({ locale })] },
  });
}

const info = (wrapper: ReturnType<typeof mountPager>) => wrapper.find('.data-table__pager-info > span').text();
/** An Ionic element's property, set by Vue on the element rather than as an attribute. */
const prop = (wrapper: ReturnType<typeof mountPager>, selector: string, name: 'disabled' | 'selectedText') =>
  (wrapper.find(selector).element as HTMLElement & Record<typeof name, unknown>)[name];
const pageButtons = (wrapper: ReturnType<typeof mountPager>) => wrapper.findAll('ion-button.data-table__page');

describe('DataTablePager', () => {
  it('a desk says the window of the page and the count, and numbers the pages around the current one', () => {
    const wrapper = mountPager({ pager: desk(2) });
    expect(info(wrapper)).toBe('Showing 21–30 of 56 records');
    expect(pageButtons(wrapper).map((b) => b.text())).toEqual(['1', '2', '3', '4', '5', '6']);
    const current = pageButtons(wrapper).find((b) => b.attributes('aria-current') === 'page');
    expect([current?.text(), current?.classes()]).toEqual(['3', expect.arrayContaining(['data-table__page--current'])]);
    expect(pageButtons(wrapper)[3].attributes('aria-label')).toBe('Page 4');
  });

  it('asks for a page by its index: a number, previous and next', async () => {
    const wrapper = mountPager({ pager: desk(2) });
    await pageButtons(wrapper)[4].trigger('click');
    await wrapper.find('[data-testid="apps-page-prev"]').trigger('click');
    await wrapper.find('[data-testid="apps-page-next"]').trigger('click');
    expect(wrapper.emitted('go')).toEqual([[4], [1], [3]]);
  });

  it('previous and next stop at the bounds', () => {
    const first = mountPager({ pager: desk(0) });
    expect(prop(first, '[data-testid="apps-page-prev"]', 'disabled')).toBe(true);
    expect(prop(first, '[data-testid="apps-page-next"]', 'disabled')).toBe(false);
    const last = mountPager({ pager: desk(5) });
    expect(prop(last, '[data-testid="apps-page-next"]', 'disabled')).toBe(true);
  });

  it('a long list shows «…» in the jumps', () => {
    const wrapper = mountPager({ pager: desk(0, 52) });
    expect(wrapper.findAll('.data-table__page-gap').map((gap) => gap.text())).toEqual(['…']);
  });

  it('a single page says only the count, in the entity’s word', () => {
    const one = { ...desk(0, 1), count: 1, rangeTo: 1 };
    expect(info(mountPager({ pager: one, entityLabel: { one: 'business', many: 'businesses' } }))).toBe('1 business');
    expect(mountPager({ pager: one }).find('.data-table__pager-nav').exists()).toBe(false);
  });

  it('windowed rows load at the end of the scroll: the range while it grows, no page buttons', () => {
    const growing = { ...desk(0), rangeTo: 20, canLoadMore: true };
    const wrapper = mountPager({ pager: growing, windowed: true });
    expect(info(wrapper)).toBe('Showing 1–20 of 56 records');
    expect(wrapper.find('.data-table__pager-nav').exists()).toBe(false);
    expect(info(mountPager({ pager: { ...growing, canLoadMore: false }, windowed: true }))).toBe('56 records');
  });

  it('a phone past its window pages with previous, next and «page / pages»', async () => {
    const wrapper = mountPager({ pager: desk(1), windowed: true, phonePaged: true });
    expect(wrapper.classes()).toContain('data-table__pager--phone-pages');
    expect(wrapper.find('.data-table__page-of').text()).toBe('2 / 6');
    expect(pageButtons(wrapper)).toHaveLength(0);
    await wrapper.find('[data-testid="apps-page-next"]').trigger('click');
    expect(wrapper.emitted('go')).toEqual([[2]]);
  });

  it('while the first rows load it counts nothing and offers no page', () => {
    const wrapper = mountPager({ pager: desk(0), awaitingRows: true });
    expect(info(wrapper)).toBe('');
    expect(wrapper.find('.data-table__pager-nav').exists()).toBe(false);
  });

  it('carries the rows-per-page select only when asked, and asks for the size picked', async () => {
    expect(mountPager().find('ion-select').exists()).toBe(false);
    const wrapper = mountPager({ sizeSelect: true, pageSize: 25 });
    const select = wrapper.find('ion-select.data-table__pager-size');
    expect([select.attributes('aria-label'), prop(wrapper, 'ion-select', 'selectedText')]).toEqual(['Rows per page', '25 / page']);
    expect(wrapper.findAll('ion-select-option').map((o) => o.text())).toEqual(['10 / page', '25 / page']);
    select.element.dispatchEvent(new CustomEvent('ionChange', { detail: { value: '10' } }));
    expect(wrapper.emitted('pageSize')).toEqual([[10]]);
  });

  it('speaks the page’s language', () => {
    const wrapper = mountPager({ pager: desk(2), sizeSelect: true }, 'es');
    expect(info(wrapper)).toBe('Mostrando 21–30 de 56 registros');
    expect(wrapper.find('[data-testid="apps-page-prev"]').attributes('aria-label')).toBe('Página anterior');
    expect(prop(wrapper, 'ion-select', 'selectedText')).toBe('10 / pág.');
  });
});
