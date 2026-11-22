import { ref, watch } from 'vue';

interface SearchSource {
  /** The rows start again from the first one: the own page and the grown window. */
  restart: () => void;
  update: (value: string) => void;
  clearFilters: () => void;
}

/** What the search box holds: the table's own, or the parent's when it hands it over (`v-model:search`). */
export function useSearch(props: Readonly<{ search?: string; serverSide: boolean }>, source: SearchSource) {
  const q = ref('');

  // `search` from the parent is the query the person is looking at; `undefined` = not controlled.
  watch(
    () => props.search,
    (value) => {
      if (value === undefined) return;
      q.value = value;
      if (!props.serverSide) source.restart();
    },
    { immediate: true },
  );

  function onSearch(value: string): void {
    q.value = value;
    if (!props.serverSide) source.restart();
    source.update(value);
  }
  /** «Show all»: drops the search and the column filters, so every row is back in one tap. */
  function resetSearch(): void {
    q.value = '';
    source.restart();
    source.update('');
    source.clearFilters();
  }

  return { q, onSearch, resetSearch };
}
