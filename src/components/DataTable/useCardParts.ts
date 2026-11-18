import { computed } from 'vue';

import { cardTitleColumn as titleColumnByText, cellText } from './model';
import type { DataTableColumn } from './types';

/** What a card is made of: its title, the column that title comes from, and the fields of its body. */
export function useCardParts<T extends object>(source: {
  columns: () => readonly DataTableColumn<T>[];
  /** The columns shown now (the column chooser's pick). */
  visible: () => readonly DataTableColumn<T>[];
  title: () => ((row: T) => string | number | null | undefined) | undefined;
  /** Key of the column the title is (`cardTitleColumn`). */
  titleColumn: () => string | undefined;
}) {
  const named = computed(() => {
    const key = source.titleColumn();
    return key ? source.columns().find((c) => c.key === key) : undefined;
  });

  /** `cardTitle`, else the painted text of the named column. */
  function cardTitleOf(row: T): string | number {
    const title = source.title();
    if (title) return title(row) ?? '';
    return named.value ? cellText(named.value, row) : '';
  }
  function cardTitleColumnOf(row: T): DataTableColumn<T> | undefined {
    const title = source.title();
    return named.value ?? (title ? titleColumnByText(title(row), row, source.visible()) : undefined);
  }
  /** The default card body leaves out the column the title already shows. */
  function cardFields(row: T): DataTableColumn<T>[] {
    const titleColumn = cardTitleColumnOf(row);
    return source.visible().filter((column) => column !== titleColumn);
  }

  return { cardTitleOf, cardTitleColumnOf, cardFields };
}
