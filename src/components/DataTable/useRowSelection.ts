import { computed, ref } from 'vue';

/** The rows ticked by their key: the table's own, or the parent's when it hands them over (`v-model:selected`). */
export function useRowSelection<T>(source: {
  selected: () => string[] | undefined;
  /** The rows on screen, which «select all» ticks. */
  visible: () => readonly T[];
  keyOf: (row: T) => string;
  emit: (keys: string[]) => void;
}) {
  const own = ref(new Set<string>());
  const selection = computed(() => {
    const given = source.selected();
    return given ? new Set(given) : own.value;
  });
  const allSelected = computed(() => {
    const rows = source.visible();
    return rows.length > 0 && rows.every((row) => selection.value.has(source.keyOf(row)));
  });

  function setSelection(next: Set<string>): void {
    if (!source.selected()) own.value = next;
    source.emit([...next]);
  }
  function toggleRow(key: string): void {
    const next = new Set(selection.value);
    if (!next.delete(key)) next.add(key);
    setSelection(next);
  }
  function toggleAll(): void {
    const keys = source.visible().map(source.keyOf);
    const next = new Set(selection.value);
    if (allSelected.value) keys.forEach((key) => next.delete(key));
    else keys.forEach((key) => next.add(key));
    setSelection(next);
  }

  return { selection, allSelected, setSelection, toggleRow, toggleAll };
}
