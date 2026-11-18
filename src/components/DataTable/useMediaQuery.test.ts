import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick } from 'vue';

import { useMediaQuery } from './useMediaQuery';

type Listener = (event: { matches: boolean }) => void;
let listeners: Listener[] = [];
let removed = 0;

function stubMedia(matches: boolean): void {
  listeners = [];
  removed = 0;
  vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches,
    addEventListener: (_: string, listener: Listener) => listeners.push(listener),
    removeEventListener: () => (removed += 1),
  }));
}

function probe(query: string) {
  let value: { value: boolean } = { value: false };
  const wrapper = mount(
    defineComponent({
      setup() {
        value = useMediaQuery(query);
        return () => h('span', String(value.value));
      },
    }),
  );
  return { wrapper, value };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useMediaQuery', () => {
  it('knows the answer from the start, before the component is mounted', () => {
    stubMedia(true);
    expect(probe('(max-width: 640px)').value.value).toBe(true);
    stubMedia(false);
    expect(probe('(max-width: 640px)').value.value).toBe(false);
  });

  it('follows the window across the breakpoint, and stops when the component goes', async () => {
    stubMedia(false);
    const { wrapper, value } = probe('(max-width: 640px)');
    listeners.forEach((listener) => listener({ matches: true }));
    await nextTick();
    expect(value.value).toBe(true);
    expect(wrapper.text()).toBe('true');
    wrapper.unmount();
    expect(removed).toBe(1);
  });

  it('without matchMedia it never matches', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(probe('(max-width: 640px)').value.value).toBe(false);
  });
});
