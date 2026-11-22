import { describe, expect, it, vi } from 'vitest';
import { nextTick, reactive } from 'vue';

import { useSearch } from './useSearch';

function setup(given: { search?: string; serverSide?: boolean } = {}) {
  const props = reactive({ search: given.search, serverSide: given.serverSide === true });
  const restart = vi.fn();
  const update = vi.fn();
  const clearFilters = vi.fn();
  const s = useSearch(props, { restart, update, clearFilters });
  return { ...s, props, restart, update, clearFilters };
}

describe('useSearch', () => {
  it('client mode: the box keeps what is typed, the rows start again and the page is told', () => {
    const s = setup();
    expect(s.q.value).toBe('');
    s.onSearch('ana');
    expect(s.q.value).toBe('ana');
    expect(s.restart).toHaveBeenCalledOnce();
    expect(s.update).toHaveBeenCalledExactlyOnceWith('ana');
  });

  it('server mode: typing is told to the page, whose rows are its own to restart', () => {
    const s = setup({ serverSide: true });
    s.onSearch('ana');
    expect(s.q.value).toBe('ana');
    expect(s.update).toHaveBeenCalledExactlyOnceWith('ana');
    expect(s.restart).not.toHaveBeenCalled();
  });

  it('a `search` from the page is the query on screen from the start, and each change of it after', async () => {
    const s = setup({ search: 'bo' });
    expect(s.q.value).toBe('bo');
    expect(s.restart).toHaveBeenCalledOnce();
    s.props.search = 'carla';
    await nextTick();
    expect(s.q.value).toBe('carla');
    expect(s.restart).toHaveBeenCalledTimes(2);
    expect(s.update).not.toHaveBeenCalled();
  });

  it('a `search` left undefined is no query: the box keeps what was typed', async () => {
    const s = setup({ search: 'bo' });
    s.onSearch('ana');
    s.props.search = undefined;
    await nextTick();
    expect(s.q.value).toBe('ana');
    expect(s.restart).toHaveBeenCalledTimes(2);
  });

  it('server mode: a `search` from the page leaves the rows to it', async () => {
    const s = setup({ search: 'bo', serverSide: true });
    s.props.search = 'carla';
    await nextTick();
    expect(s.q.value).toBe('carla');
    expect(s.restart).not.toHaveBeenCalled();
  });

  it('«Show all» drops the search and the column filters and starts the rows again, in either mode', () => {
    for (const serverSide of [false, true]) {
      const s = setup({ serverSide });
      s.q.value = 'ana';
      s.resetSearch();
      expect(s.q.value).toBe('');
      expect([s.restart.mock.calls.length, s.update.mock.calls, s.clearFilters.mock.calls.length]).toEqual([1, [['']], 1]);
    }
  });
});
