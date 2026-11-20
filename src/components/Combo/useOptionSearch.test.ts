import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';

import type { ComboOption, ComboSearch } from './types';
import { useOptionSearch } from './useOptionSearch';

const SPAIN: ComboOption = { id: 'ES', label: 'España' };
const FRANCE: ComboOption = { id: 'FR', label: 'Francia' };

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** A server whose answers the test gives by hand, in any order. */
function server() {
  const calls: { query: string; answer: (options: ComboOption[]) => void; fail: (error: unknown) => void }[] = [];
  const search = vi.fn(
    (query: string) => new Promise<ComboOption[]>((answer, fail) => calls.push({ query, answer, fail })),
  );
  return { search, calls };
}

function setup(search: ComboSearch | undefined, debounce = 150) {
  let options!: ReturnType<typeof useOptionSearch>;
  const host = mount(
    defineComponent({
      setup() {
        options = useOptionSearch({ search, debounce });
        return () => h('div');
      },
    }),
  );
  return { ...options, host };
}

/** «f» asked, and «fr» asked after it while the server still thinks about «f». */
function twoQuestions() {
  const { search, calls } = server();
  const s = setup(search);
  s.ask('f');
  vi.advanceTimersByTime(150);
  s.ask('fr');
  vi.advanceTimersByTime(150);
  return { ...s, calls };
}

describe('useOptionSearch', () => {
  it('asks `debounce` ms after the last question, once, with its text, and keeps the answer', async () => {
    const { search, calls } = server();
    const s = setup(search, 300);
    s.ask('f');
    s.ask('fr');
    vi.advanceTimersByTime(299);
    expect(search).not.toHaveBeenCalled();
    expect([s.loading.value, s.found.value]).toEqual([true, []]);
    vi.advanceTimersByTime(1);
    expect(search.mock.calls).toEqual([['fr']]);
    calls[0].answer([FRANCE]);
    await flushPromises();
    expect([s.loading.value, s.failed.value, s.found.value]).toEqual([false, false, [FRANCE]]);
  });

  it('a new question empties the last answer and its error at once', async () => {
    const { search, calls } = server();
    const s = setup(search);
    s.ask('');
    vi.advanceTimersByTime(150);
    calls[0].answer([SPAIN]);
    await flushPromises();
    s.ask('x');
    expect([s.loading.value, s.found.value]).toEqual([true, []]);
    vi.advanceTimersByTime(150);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    calls[1].fail(new Error('offline'));
    await flushPromises();
    s.ask('xy');
    expect([s.loading.value, s.failed.value]).toEqual([true, false]);
  });

  it('an older answer that arrives late never replaces a newer one, nor ends its loading', async () => {
    const { calls, ...s } = twoQuestions();
    calls[0].answer([SPAIN, FRANCE]);
    await flushPromises();
    expect([s.loading.value, s.found.value]).toEqual([true, []]);
    calls[1].answer([FRANCE]);
    await flushPromises();
    expect([s.loading.value, s.found.value]).toEqual([false, [FRANCE]]);
  });

  it('a failed search says so and logs why; an older one failing late is dropped', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { calls, ...s } = twoQuestions();
    calls[0].fail(new Error('late'));
    await flushPromises();
    expect([s.loading.value, s.failed.value]).toEqual([true, false]);
    expect(error).not.toHaveBeenCalled();
    const offline = new Error('offline');
    calls[1].fail(offline);
    await flushPromises();
    expect([s.loading.value, s.failed.value, s.found.value]).toEqual([false, true, []]);
    expect(error).toHaveBeenCalledWith('Combo: the search failed', offline);
  });

  it('cancel drops the question on its way: it is never asked, or its answer is not kept, and nothing loads', async () => {
    const { search, calls } = server();
    const s = setup(search);
    s.ask('f');
    s.cancel();
    vi.advanceTimersByTime(150);
    expect(search).not.toHaveBeenCalled();
    expect(s.loading.value).toBe(false);
    s.ask('fr');
    vi.advanceTimersByTime(150);
    s.cancel();
    calls[0].answer([FRANCE]);
    await flushPromises();
    expect([s.loading.value, s.found.value]).toEqual([false, []]);
  });

  it('without a search, asking does nothing', () => {
    const s = setup(undefined);
    s.ask('f');
    vi.advanceTimersByTime(150);
    expect([s.loading.value, s.failed.value, s.found.value]).toEqual([false, false, []]);
  });

  it('the question waiting for its time is not asked once the component around it goes away', () => {
    const { search } = server();
    const s = setup(search);
    s.ask('f');
    s.host.unmount();
    vi.advanceTimersByTime(150);
    expect(search).not.toHaveBeenCalled();
  });
});
