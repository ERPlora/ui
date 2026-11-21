import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import InlineFeedback from '../InlineFeedback/InlineFeedback.vue';
import { clearPage, click, dataRows, mountTable, NAME, PEOPLE, settle, text, type, viewport } from './__tests__/harness';

beforeEach(() => {
  viewport(false);
});

afterEach(() => {
  clearPage();
  document.documentElement.lang = '';
});

describe('«still loading» is not «empty»', () => {
  const base = { serverSide: true, rows: [], total: 0, columns: NAME, title: 'Customers', emptyMessage: 'No customers.' };
  const loading = (t: ReturnType<typeof mountTable>) => t.element.querySelector('[data-role="loading"]');
  const pager = (t: ReturnType<typeof mountTable>) => text(t.element.querySelector('.data-table__pager'));

  it('a first load does not count zero records nor claim the list is empty; announced and busy', async () => {
    const t = mountTable({ ...base, loading: true });
    await settle();
    expect(t.text()).not.toContain('No customers.');
    expect(t.find('.data-table__empty').exists()).toBe(false);
    expect(t.find('.data-table__title-count').exists()).toBe(false);
    expect(t.find('.data-table__pager').exists(), 'the page-size selector lives in the toolbar').toBe(false);
    expect(loading(t)?.getAttribute('role')).toBe('status');
    expect(text(loading(t))).toBe('Loading…');
    expect(loading(t)?.querySelectorAll('ion-skeleton-text').length).toBeGreaterThan(2);
    expect(t.find('.data-table__surface').attributes('aria-busy')).toBe('true');
  });

  it('without a toolbar the footer keeps its page-size selector but no count, nor paging on an old total', async () => {
    const t = mountTable({ ...base, title: '', columnPicker: false, total: 50, loading: true });
    await settle();
    expect(t.find('.data-table__bar').exists()).toBe(false);
    expect(t.find('.data-table__pager ion-select.data-table__pager-size').exists()).toBe(true);
    expect(pager(t)).not.toMatch(/records?|Showing/);
    expect(t.find('.data-table__pager-nav').exists()).toBe(false);
  });

  it('when the answer arrives it counts and shows it; an empty answer is «empty» and «0 records»', async () => {
    const t = mountTable({ ...base, loading: true });
    await settle();
    await t.setProps({ loading: false, rows: PEOPLE, total: 2 });
    await settle();
    expect(loading(t)).toBeNull();
    expect(t.find('.data-table__surface').attributes('aria-busy')).toBeUndefined();
    expect(t.find('.data-table__title-count').text()).toBe('2');
    expect(pager(t)).toMatch(/\b2 records\b/);
    const empty = mountTable({ ...base, loading: true });
    await settle();
    await empty.setProps({ loading: false });
    await settle();
    expect(empty.text()).toContain('No customers.');
    expect(pager(empty)).toMatch(/\b0 records\b/);
  });

  it('a reload with rows on screen keeps them and their count, busy', async () => {
    const t = mountTable({ ...base, rows: PEOPLE, total: 2, loading: true });
    await settle();
    expect(loading(t)).toBeNull();
    expect(t.text()).toContain('Ana');
    expect(t.find('.data-table__surface').attributes('aria-busy')).toBe('true');
  });

  it('a retry in flight shows the indicator, not the old error nor the rows left over', async () => {
    const t = mountTable({ ...base, rows: PEOPLE, total: 2, error: 'The hub is not responding.', loading: true });
    await settle();
    expect(t.find('[data-role="load-error"]').exists()).toBe(false);
    expect(t.text()).not.toContain('Ana');
    expect(loading(t)).not.toBeNull();
  });

  it('the card view and client mode show it too; Spanish; worded through `labels`; hooked by `testid`', async () => {
    const cardsView = mountTable({ ...base, views: ['table', 'cards'], defaultView: 'cards', loading: true });
    const client = mountTable({ ...base, serverSide: false, loading: true });
    const es = mountTable({ ...base, loading: true }, { locale: 'es' });
    const worded = mountTable({ ...base, loading: true, labels: { loading: 'Fetching customers…' }, testid: 'customers' });
    await settle();
    expect(text(loading(cardsView))).toBe('Loading…');
    expect(loading(client)).not.toBeNull();
    expect(text(loading(es))).toBe('Cargando…');
    expect(text(loading(worded))).toBe('Fetching customers…');
    expect(loading(worded)?.getAttribute('data-testid')).toBe('customers-loading');
  });

  it('on a phone: no count and nothing loading at the end while the first load is in flight', async () => {
    viewport(true);
    const t = mountTable({ ...base, total: 40, loading: true });
    await settle();
    expect(t.find('ion-infinite-scroll').exists()).toBe(false);
    expect(t.text()).not.toMatch(/\brecords\b/);
  });
});

describe('«could not load» is not «empty»', () => {
  const REASON = 'The hub is not responding. Try again in a moment.';
  const base = { serverSide: true, rows: [], total: 0, columns: NAME, title: 'Customers', emptyMessage: 'No customers.' };
  const errorBlock = (t: ReturnType<typeof mountTable>) => t.element.querySelector('[data-role="load-error"]');
  const retry = (t: ReturnType<typeof mountTable>) => t.element.querySelector('[data-role="load-error-retry"]');

  it('says so, gives the reason, is announced and does not count nor claim «empty»', async () => {
    const t = mountTable({ ...base, error: REASON });
    await settle();
    expect(t.text()).not.toContain('No customers.');
    expect(t.text()).not.toMatch(/\b0 records\b/);
    expect(t.find('.data-table__title-count').exists()).toBe(false);
    expect(t.findComponent(InlineFeedback).props()).toMatchObject({ tone: 'danger', heading: "Couldn't load the data" });
    expect(text(errorBlock(t))).toContain("Couldn't load the data");
    expect(text(errorBlock(t))).toContain(REASON);
    expect(text(retry(t))).toBe('Retry');
  });

  it('Retry emits `retry` once', async () => {
    const t = mountTable({ ...base, error: REASON });
    await settle();
    await click(retry(t));
    expect(t.emitted('retry')).toHaveLength(1);
  });

  it('rows left from an earlier load are not shown as current, in the list or the cards', async () => {
    const list = mountTable({ ...base, rows: PEOPLE, total: 2, error: REASON });
    const cardsView = mountTable({ ...base, rows: PEOPLE, total: 2, error: REASON, views: ['table', 'cards'], defaultView: 'cards' });
    await settle();
    expect(dataRows(list)).toHaveLength(0);
    expect(list.text()).not.toMatch(/\b2 records\b/);
    expect(cardsView.find('.data-table__cards').exists()).toBe(false);
    expect(retry(cardsView)).not.toBeNull();
  });

  it('on a phone: no pager at all while the load failed', async () => {
    viewport(true);
    const t = mountTable({ ...base, rows: PEOPLE, total: 40, error: REASON });
    await settle();
    expect(t.find('.data-table__pager').exists()).toBe(false);
  });

  it('clearing the error brings the normal states back; a blank reason is not an error', async () => {
    const t = mountTable({ ...base, error: REASON });
    await settle();
    await t.setProps({ error: '' });
    await settle();
    expect(errorBlock(t)).toBeNull();
    expect(t.text()).toContain('No customers.');
    const blank = mountTable({ ...base, error: '   ' });
    await settle();
    expect(errorBlock(blank)).toBeNull();
  });

  it('client mode too; Spanish; worded through `labels`; hooked by `testid`', async () => {
    const client = mountTable({ ...base, serverSide: false, rows: PEOPLE, error: REASON });
    const es = mountTable({ ...base, error: 'El hub no responde.' }, { locale: 'es' });
    const worded = mountTable({ ...base, error: REASON, labels: { loadError: 'Customers could not be loaded', retry: 'Try again' }, testid: 'customers' });
    await settle();
    expect(client.text()).not.toContain('Ana');
    expect(errorBlock(client)).not.toBeNull();
    expect(text(errorBlock(es))).toContain('No se han podido cargar los datos');
    expect(text(retry(es))).toBe('Reintentar');
    expect(text(errorBlock(worded))).toContain('Customers could not be loaded');
    expect(text(retry(worded))).toBe('Try again');
    expect(retry(worded)?.getAttribute('data-testid')).toBe('customers-retry');
  });

  // Pages hand the same text as the title (`labels.loadError`) and as the reason (`error`):
  // the notice said it twice in a row. A reason that only repeats the title is not painted again.
  it('a reason that repeats the title is said once, with Retry: worded, Spanish, default title, case and full stop aside', async () => {
    const times = (t: ReturnType<typeof mountTable>, phrase: string) => text(errorBlock(t)).split(phrase).length - 1;
    const reason = (t: ReturnType<typeof mountTable>) => errorBlock(t)?.querySelector('.data-table__error-reason');
    const same = mountTable({ ...base, error: 'The tasks could not be loaded.', labels: { loadError: 'The tasks could not be loaded.' } });
    const es = mountTable({ ...base, error: 'No se han podido cargar las tareas.', labels: { loadError: 'No se han podido cargar las tareas.', retry: 'Reintentar' } }, { locale: 'es' });
    const fallback = mountTable({ ...base, error: "Couldn't load the data" });
    const loose = mountTable({ ...base, error: '  could not load  the tickets. ', labels: { loadError: 'Could not load the tickets' } });
    await settle();
    expect(times(same, 'The tasks could not be loaded.')).toBe(1);
    expect(times(es, 'No se han podido cargar las tareas.')).toBe(1);
    expect(times(fallback, "Couldn't load the data")).toBe(1);
    expect(times(loose, 'Could not load the tickets')).toBe(1);
    expect(loose.findComponent(InlineFeedback).props('heading')).toBe('Could not load the tickets');
    for (const t of [same, es, fallback, loose]) {
      expect(reason(t)).toBeNull();
      expect(t.findComponent(InlineFeedback).props('tone')).toBe('danger');
      expect(retry(t)).not.toBeNull();
    }
    expect(text(retry(es))).toBe('Reintentar');
  });

  it('a reason that says more than the title is still painted under it', async () => {
    const t = mountTable({ ...base, error: 'The tasks could not be loaded. The hub is not responding.', labels: { loadError: 'The tasks could not be loaded.' } });
    await settle();
    expect(text(errorBlock(t)?.querySelector('.data-table__error-reason'))).toBe('The tasks could not be loaded. The hub is not responding.');
  });
});

describe('«no matches» is not «empty»', () => {
  const ROWS = [{ id: 1, name: 'Restaurant' }, { id: 2, name: 'Hair salon' }];
  const base = { rows: ROWS, columns: NAME, searchKeys: ['name'], emptyMessage: 'No templates published yet' };
  const empty = (t: ReturnType<typeof mountTable>) => text(t.element.querySelector('.data-table__empty'));
  const reset = (t: ReturnType<typeof mountTable>) => t.element.querySelector('[data-role="no-matches-reset"]');

  it('a search that hides every row says so and offers «Show all»', async () => {
    const t = mountTable(base);
    await settle();
    await type(t, 'zzz');
    expect(dataRows(t)).toHaveLength(0);
    expect(empty(t)).toContain('No results match your search or filters');
    expect(empty(t)).not.toContain('No templates published yet');
    expect(text(reset(t))).toBe('Show all');
  });

  it('no rows at all is «empty», even with a search left in the box, and offers no reset', async () => {
    const t = mountTable({ ...base, rows: [] });
    await settle();
    await type(t, 'zzz');
    expect(empty(t)).toContain('No templates published yet');
    expect(reset(t)).toBeNull();
  });

  it('`noMatchesMessage`, `labels` and Spanish word it', async () => {
    const own = mountTable({ ...base, noMatchesMessage: 'No template matches' });
    const labelled = mountTable({ ...base, labels: { noMatches: 'Nope', showAll: 'Everything' } });
    const es = mountTable(base, { locale: 'es' });
    await settle();
    for (const t of [own, labelled, es]) await type(t, 'zzz');
    expect(empty(own)).toContain('No template matches');
    expect(empty(labelled)).toContain('Nope');
    expect(text(reset(labelled))).toBe('Everything');
    expect(empty(es)).toContain('Ningún resultado coincide con la búsqueda o los filtros');
    expect(text(reset(es))).toBe('Mostrar todo');
  });

  it('«Show all» clears the search: every row back, the box empty, the v-model told', async () => {
    const t = mountTable(base);
    await settle();
    await type(t, 'zzz');
    await click(reset(t));
    expect(t.find('.data-table__empty').exists()).toBe(false);
    expect(dataRows(t)).toHaveLength(2);
    expect((t.element.querySelector('ion-searchbar') as HTMLElement & { value?: string }).value).toBe('');
    expect(t.emitted('update:search')?.at(-1)).toEqual(['']);
  });

  it('server mode keeps its own empty message: the consumer owns the query', async () => {
    const t = mountTable({ ...base, serverSide: true, searchable: true, rows: [] });
    await settle();
    await type(t, 'zzz');
    expect(empty(t)).toContain('No templates published yet');
    expect(reset(t)).toBeNull();
  });

  it('the `empty` slot replaces the content of the empty state', async () => {
    const t = mountTable({ ...base, rows: [] }, { slots: { empty: '<p class="own-empty">Nothing yet</p>' } });
    await settle();
    expect(t.find('.data-table__empty .own-empty').text()).toBe('Nothing yet');
  });
});
