import { describe, expect, it } from 'vitest';
import { reactive, ref } from 'vue';

import type { DataTableLabelKey } from './types';
import { useTableStates } from './useTableStates';

const label = (key: DataTableLabelKey): string => (key === 'loadError' ? 'Couldn’t load the data' : key);

function setup() {
  const props = reactive({
    error: undefined as string | undefined,
    loading: false,
    rows: [] as unknown[],
    hideToolbarWhenEmpty: false,
    serverSide: false,
    total: 0,
    pageSizeChooser: true,
    pageSizeOptions: [10, 25],
  });
  const query = ref('');
  const filtering = ref(false);
  const hasToolbar = ref(true);
  const pages = ref(1);
  const s = useTableStates(props, {
    query: () => query.value,
    filtering: () => filtering.value,
    hasToolbar: () => hasToolbar.value,
    pages: () => pages.value,
    label,
  });
  return { ...s, props, query, filtering, hasToolbar, pages };
}

describe('useTableStates', () => {
  it('a load with nothing current to show is awaited; rows already on screen stay while it runs', () => {
    const s = setup();
    s.props.loading = true;
    expect([s.awaitingRows.value, s.loadFailed.value]).toEqual([true, false]);
    s.props.rows = [{ id: 'a' }];
    expect(s.awaitingRows.value).toBe(false);
    s.props.error = 'Timeout';
    expect([s.awaitingRows.value, s.loadFailed.value]).toEqual([true, false]);
  });

  it('the last load failed when a reason is given and no load runs; a blank reason is none', () => {
    const s = setup();
    s.props.rows = [{ id: 'a' }];
    s.props.error = 'Timeout';
    expect(s.loadFailed.value).toBe(true);
    s.props.error = '  ';
    expect(s.loadFailed.value).toBe(false);
  });

  it('paints the reason under the title unless it only repeats it, case, spacing and the closing stop aside', () => {
    const s = setup();
    s.props.error = '  couldn’t   LOAD the data… ';
    expect(s.errorReason.value).toBe('');
    s.props.error = 'Timeout';
    expect(s.errorReason.value).toBe('Timeout');
  });

  it('`hideToolbarWhenEmpty`: a list with no record at all leaves its toolbar out', () => {
    const s = setup();
    expect(s.showTopbar.value).toBe(true);
    s.props.hideToolbarWhenEmpty = true;
    s.query.value = '  ';
    expect(s.showTopbar.value).toBe(false);
    s.props.serverSide = true;
    expect(s.showTopbar.value).toBe(false);
  });

  it('`hideToolbarWhenEmpty` keeps the toolbar for a search, a filter, a load, a failure or records on another page', () => {
    const cases: ((s: ReturnType<typeof setup>) => void)[] = [
      (s) => (s.query.value = 'ana'),
      (s) => (s.filtering.value = true),
      (s) => (s.props.loading = true),
      (s) => (s.props.error = 'Timeout'),
      (s) => (s.props.rows = [{ id: 'a' }]),
      (s) => Object.assign(s.props, { serverSide: true, total: 3 }),
    ];
    for (const turnOn of cases) {
      const s = setup();
      s.props.hideToolbarWhenEmpty = true;
      turnOn(s);
      expect([String(turnOn), s.showTopbar.value]).toEqual([String(turnOn), true]);
    }
  });

  it('no toolbar the props ask for is no toolbar, with records or without', () => {
    const s = setup();
    s.hasToolbar.value = false;
    expect(s.showTopbar.value).toBe(false);
    s.props.rows = [{ id: 'a' }];
    expect(s.showTopbar.value).toBe(false);
  });

  it('the rows-per-page selector exists with the chooser on and some sizes to choose', () => {
    const s = setup();
    expect(s.pageSizeSelectable.value).toBe(true);
    s.props.pageSizeOptions = [];
    expect(s.pageSizeSelectable.value).toBe(false);
    s.props.pageSizeOptions = [10];
    s.props.pageSizeChooser = false;
    expect(s.pageSizeSelectable.value).toBe(false);
  });

  it('the pager: with more than one page or sizes to choose, never with a failure or a bare empty list', () => {
    const s = setup();
    s.props.rows = [{ id: 'a' }];
    expect(s.showPager.value).toBe(true);
    s.props.pageSizeOptions = [];
    expect(s.showPager.value).toBe(false);
    s.pages.value = 2;
    expect(s.showPager.value).toBe(true);
    s.props.error = 'Timeout';
    expect(s.showPager.value).toBe(false);
    s.props.error = undefined;
    s.props.rows = [];
    s.props.hideToolbarWhenEmpty = true;
    expect(s.showPager.value).toBe(false);
  });

  it('while rows are awaited the pager only carries the rows-per-page selector a toolbar does not', () => {
    const s = setup();
    s.props.loading = true;
    s.pages.value = 3;
    expect(s.showPager.value).toBe(false);
    s.hasToolbar.value = false;
    expect(s.showPager.value).toBe(true);
    s.props.pageSizeChooser = false;
    expect(s.showPager.value).toBe(false);
  });

  it('rows that exist but are all hidden by the search are no empty list', () => {
    const s = setup();
    expect(s.noMatches.value).toBe(false);
    s.props.rows = [{ id: 'a' }];
    expect(s.noMatches.value).toBe(true);
  });
});
