import { onBeforeUnmount, ref, shallowRef } from 'vue';

import type { ComboOption, ComboSearch } from './types';

interface SearchProps {
  /** Asks the server for the options of a text (`''` on opening). */
  search?: ComboSearch;
  /** Milliseconds after the last key before `search` is asked. */
  debounce: number;
}

/** The options the server answers for a text, asked `debounce` ms after the last key: an answer to an older
 *  question is dropped. */
export function useOptionSearch(props: SearchProps) {
  const found = shallowRef<ComboOption[]>([]);
  const loading = ref(false);
  const failed = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Number of the last question to the server: an older answer is dropped. */
  let asked = 0;

  function ask(value: string): void {
    if (!props.search) return;
    clearTimeout(timer);
    const mine = ++asked;
    found.value = [];
    loading.value = true;
    failed.value = false;
    timer = setTimeout(() => void answer(value, mine), props.debounce);
  }

  async function answer(value: string, mine: number): Promise<void> {
    try {
      const options = await props.search!(value);
      if (mine === asked) found.value = options;
    } catch (error) {
      if (mine !== asked) return;
      failed.value = true;
      console.error('Combo: the search failed', error);
    } finally {
      if (mine === asked) loading.value = false;
    }
  }

  /** Drops the question on its way: it is not asked, or its answer is not kept. */
  function cancel(): void {
    clearTimeout(timer);
    asked += 1;
    loading.value = false;
  }

  onBeforeUnmount(() => clearTimeout(timer));

  return { found, loading, failed, ask, cancel };
}
