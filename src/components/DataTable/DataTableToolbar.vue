<script setup lang="ts" generic="T extends object">
// The table's toolbar row: its title with the records counted, the search box, the page's own filters, the column
// chooser, rows per page, the list/cards switch, the filters funnel and the create and primary buttons. The table
// keeps what each control changes: this row paints them and hands every pick over.
import { IonButton, IonIcon, IonSearchbar, IonSegment, IonSegmentButton, IonSelect, IonSelectOption } from '@ionic/vue';
import { computed, onMounted, onUpdated, ref } from 'vue';

import { syncSearchbarInputName } from './searchbarName';
import type { DataTableColumn, DataTableLabels, DataTablePrimaryAction, DataTableView } from './types';
import { usePartChrome } from './usePartChrome';

const props = withDefaults(
  defineProps<{
    title: string;
    /** The last load failed: nothing current to count. */
    loadFailed: boolean;
    /** The first rows are loading: nothing to count yet. */
    awaitingRows: boolean;
    /** The records counted next to the title. */
    count: number;
    hasSearch: boolean;
    /** The query in the search box. */
    search: string;
    /** Hint of the search box. Default: the «Search…» label. */
    searchPlaceholder?: string;
    /** Every column: the options of the column chooser. */
    columns: DataTableColumn<T>[];
    /** What the column chooser marks: what the current view paints. */
    shownColumns: DataTableColumn<T>[];
    columnPicker: boolean;
    /** A phone: neither the column chooser nor the rows-per-page select. */
    isMobile: boolean;
    pageSizeSelectable: boolean;
    pageSize: number;
    pageSizeOptions: number[];
    viewToggle: boolean;
    viewMode: DataTableView;
    /** The funnel that opens the filters panel. */
    showFunnel: boolean;
    filterPanelOpen: boolean;
    /** Some filter is applied: the funnel is solid and counts them. */
    filtering: boolean;
    /** A filter was refused: the funnel turns red. */
    refused: boolean;
    /** The filtered columns (a range counts once). */
    filterCount: number;
    addable: boolean;
    primaryAction?: DataTablePrimaryAction;
    labels?: Partial<DataTableLabels>;
    testid?: string;
  }>(),
  { searchPlaceholder: undefined, primaryAction: undefined, labels: undefined, testid: undefined },
);

const emit = defineEmits<{
  search: [value: string];
  columns: [keys: string[]];
  pageSize: [size: number];
  view: [view: DataTableView];
  /** The funnel was pressed: the filters panel opens, or closes. */
  filters: [];
  add: [];
  primaryAction: [];
}>();

const { ICONS, icon, label, tid } = usePartChrome(props);
const root = ref<HTMLElement | null>(null);
const searchHint = computed(() => props.searchPlaceholder ?? label('search'));
const funnelName = computed(() => {
  if (props.refused) return label('filtersInvalid');
  const n = props.filterCount;
  if (!n) return label('filters');
  return label(n === 1 ? 'filtersActiveOne' : 'filtersActiveMany', { n });
});

function onSearch(ev: Event): void {
  emit('search', (ev.target as HTMLInputElement | null)?.value ?? '');
}
const onColumnsPicked = (ev: CustomEvent<{ value?: unknown }>): void =>
  emit('columns', Array.isArray(ev.detail.value) ? ev.detail.value.map(String) : []);
const onPageSizeSelect = (ev: CustomEvent<{ value?: unknown }>): void => emit('pageSize', Number(ev.detail.value));
/** The list/cards ion-segment: anything but a view is ignored. */
function onViewPicked(ev: CustomEvent<{ value?: unknown }>): void {
  const view = ev.detail.value;
  if (view !== 'table' && view !== 'cards') return;
  emit('view', view);
}

// The search box is named after its hint, and its clear button with its own text, after every render.
function nameSearchBox(): void {
  syncSearchbarInputName(root.value, () => searchHint.value, () => label('clearSearch'));
}
onMounted(nameSearchBox);
onUpdated(nameSearchBox);
</script>

<template>
  <div
    ref="root"
    class="data-table__bar-main"
  >
    <div
      v-if="title"
      class="data-table__title-wrap"
    >
      <h2 class="data-table__title">
        {{ title }}
      </h2>
      <span
        v-if="!loadFailed && !awaitingRows"
        class="data-table__title-count"
      >{{ count }}</span>
    </div>
    <div
      v-if="hasSearch"
      class="data-table__search"
    >
      <ion-searchbar
        class="ion-no-border"
        :data-testid="tid('search')"
        :value="search"
        :placeholder="searchHint"
        :debounce="250"
        @ion-input="onSearch"
      />
    </div>
    <slot name="filters" />
    <span class="data-table__spacer" />
    <ion-select
      v-if="columnPicker && !isMobile"
      class="data-table__columns-select"
      :multiple="true"
      interface="popover"
      :aria-label="label('columnsVisible')"
      :value="shownColumns.map((c) => c.key)"
      :selected-text="label('columns')"
      @ion-change="onColumnsPicked"
    >
      <ion-select-option
        v-for="column in columns"
        :key="column.key"
        :value="column.key"
      >
        {{ column.label }}
      </ion-select-option>
    </ion-select>
    <ion-select
      v-if="pageSizeSelectable && !isMobile"
      class="data-table__page-size-select"
      interface="popover"
      :aria-label="label('rowsPerPage')"
      :value="pageSize"
      @ion-change="onPageSizeSelect"
    >
      <ion-select-option
        v-for="size in pageSizeOptions"
        :key="size"
        :value="size"
      >
        {{ size }}
      </ion-select-option>
    </ion-select>
    <!-- The list/cards switch is Ionic's segment: it marks the checked one. -->
    <ion-segment
      v-if="viewToggle"
      class="data-table__view-segment"
      :data-testid="tid('view')"
      :value="viewMode"
      @ion-change="onViewPicked"
    >
      <ion-segment-button
        value="table"
        :data-testid="tid('view-table')"
        :title="label('viewList')"
        :aria-label="label('viewList')"
      >
        <ion-icon
          :icon="icon(ICONS.list)"
          aria-hidden="true"
        />
      </ion-segment-button>
      <ion-segment-button
        value="cards"
        :data-testid="tid('view-cards')"
        :title="label('viewCards')"
        :aria-label="label('viewCards')"
      >
        <ion-icon
          :icon="icon(ICONS.cards)"
          aria-hidden="true"
        />
      </ion-segment-button>
    </ion-segment>
    <!-- The funnel, solid while filtering, with the count of filtered columns.
         A toggle (`aria-pressed`): an ion-button hands a CHANGED aria-label/-pressed/-checked to its
         native button, never an aria-expanded (it stays on the host, where no reader sees it). -->
    <ion-button
      v-if="showFunnel"
      class="data-table__filter-button"
      size="small"
      :fill="filterPanelOpen || filtering ? 'solid' : 'outline'"
      :color="refused ? 'danger' : undefined"
      :data-invalid="refused ? 'true' : undefined"
      :title="label('filters')"
      :aria-label="funnelName"
      :aria-pressed="filterPanelOpen ? 'true' : 'false'"
      :data-testid="tid('filters-toggle')"
      @click="emit('filters')"
    >
      <ion-icon
        slot="icon-only"
        :icon="icon(ICONS.filters)"
        aria-hidden="true"
      />
      <span
        v-if="filtering"
        class="data-table__filter-count"
        aria-hidden="true"
        :data-testid="tid('filters-count')"
      >{{ filterCount }}</span>
    </ion-button>
    <!-- The main action of the screen is read, not guessed: labelled in every viewport. -->
    <ion-button
      v-if="addable"
      class="data-table__primary-button data-table__add-button"
      :data-testid="tid('add')"
      size="small"
      @click="emit('add')"
    >
      <ion-icon
        slot="start"
        :icon="icon(ICONS.add)"
        aria-hidden="true"
      />{{ label('add') }}
    </ion-button>
    <ion-button
      v-if="primaryAction"
      class="data-table__primary-button data-table__add-button"
      :data-testid="tid('primary-action')"
      size="small"
      @click="emit('primaryAction')"
    >
      <ion-icon
        slot="start"
        :icon="icon(primaryAction.icon ?? ICONS.add)"
        aria-hidden="true"
      />{{ primaryAction.label }}
    </ion-button>
    <slot name="toolbar" />
  </div>
</template>

<style scoped src="./controls.css"></style>

<style scoped>
/* ONE flex row that wraps item by item; the spacer pushes the right cluster to the edge. */
.data-table__bar-main { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.data-table__bar-main > ion-button { --padding-start: 0.5rem; --padding-end: 0.5rem; margin: 0; }
.data-table__spacer { flex: 1 1 0; min-width: 0; align-self: stretch; }
@media (max-width: 1024px) { .data-table__spacer { display: none; } }
/* The search box takes its own line on a phone. */
@media (max-width: 640px) { .data-table__search { flex-basis: 100%; max-width: none; } }
.data-table__title-wrap { display: flex; align-items: baseline; gap: 0.5rem; }
.data-table__title { font-size: 15px; font-weight: 600; line-height: 1; margin: 0; letter-spacing: inherit; }
.data-table__title-count { font-size: 12px; font-weight: 500; color: var(--color-muted); }

/* Search box: does not grow (the spacer takes the gap); shrinks to its minimum, then wraps. Its
   ion-searchbar rules live in the unscoped block below. */
.data-table__search { flex: 0 1 22rem; min-width: 12rem; max-width: 24rem; }
/* A tablet, without the spacer: the line breaks at the search's 12rem minimum (a wrapping row breaks at each
   item's basis) and the search grows back to its 22rem, so the funnel does not drop alone to a second line
   at 834px or 820px. After the rule above, which it overrides; from 641px, so a phone keeps the search on its own line. */
@media (min-width: 641px) and (max-width: 1024px) { .data-table__search { flex: 1 1 12rem; max-width: 22rem; } }
/* One clear cross: Chromium's native cancel button of `type=search` hidden. Alone in its rule. */
.data-table__search :deep(input::-webkit-search-cancel-button) { -webkit-appearance: none; appearance: none; display: none; }
/* The example text ends in «…» where the box is short of it (otherwise, at 820px it is cut with no sign,
   measured in Chromium). */
.data-table__search :deep(.searchbar-input) { text-overflow: ellipsis; }

/* List/cards switch: Ionic's segment. An ion-segment is 100% wide by default:
   here it takes only its buttons; icon-only buttons as tall as the toolbar controls. */
.data-table__view-segment { flex: 0 0 auto; width: auto; }
.data-table__view-segment ion-segment-button { min-width: 44px; min-height: 44px; }

/* The toolbar's main buttons («Add», `primaryAction`): labelled, filled (controls.css) and at least 44px tall. */
.data-table__add-button { min-height: 44px; --border-radius: 10px; --padding-start: 0.9rem; --padding-end: 1rem; margin: 0; font-weight: 600; }
.data-table__add-button ion-icon { margin-inline-end: 0.35rem; }

/* Toolbar selects: visible background and border, like the search box. */
.data-table__columns-select { min-width: 6.5rem; max-width: 9rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.3rem; --padding-bottom: 0.3rem; }
.data-table__page-size-select { min-width: 4.25rem; max-width: 5.5rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.35rem; --padding-bottom: 0.35rem; }
/* A select the page adds in the `filters` (or `toolbar`) slot: boxed like the two above and as wide as the option it
   shows. Ionic's select fills its box, so a fixed cap cut a longer option («Todos los tipos») even with room to spare. */
.data-table__bar-main > :slotted(ion-select) { width: auto; min-width: 6.5rem; max-width: 16rem; min-height: 44px; font-size: 13px; background: var(--background); color: var(--color); border: 1px solid var(--control-border); border-radius: 10px; --padding-start: 0.6rem; --padding-end: 0.4rem; --padding-top: 0.3rem; --padding-bottom: 0.3rem; }

/* The funnel of the filters panel (`filterable`): a 44px tool button, solid while filtering, with the count of
   filtered columns. */
.data-table__filter-button { position: relative; --padding-start: 0; --padding-end: 0; --border-radius: 10px; width: 44px; height: 44px; margin: 0; --overflow: visible; }
.data-table__filter-button .data-table__filter-count { position: absolute; top: -5px; right: -5px; min-width: 16px; height: 16px; padding: 0 3px; border-radius: 999px; background: var(--primary); color: var(--primary-contrast); font-size: 10px; font-weight: 700; line-height: 16px; text-align: center; pointer-events: none; }

@media (pointer: coarse), (max-width: 834px) {
  .data-table__view-segment ion-segment-button { min-height: 44px; }
  .data-table__filter-button { width: 44px; height: 44px; }
  .data-table__add-button { min-height: 44px; }
}
</style>

<style>
/* Unscoped on purpose: these rules must stay WEAK, so that Ionic's own scoped searchbar classes
   (`.sc-ion-searchbar-ios-h`, 0,1,0) beat them on every property both set: the box keeps Ionic's
   12px padding and its grey field. A scoped copy would carry Vue's attribute
   and win. `:where()` limits them to the table. */
:where(.data-table__search) ion-searchbar { --background: var(--background); --border-radius: 10px; padding: 0; min-height: 44px; }
:where(.data-table__search) ion-searchbar.ion-no-border { --box-shadow: none; }
/* Focused, the field shows it: the theme's accent ring and a soft halo of the same colour.
   After the rule above, which has the same weight. Ionic's own `--box-shadow: none` is lighter. */
:where(.data-table__search) ion-searchbar:focus-within, :where(.data-table__search) ion-searchbar.searchbar-has-focus { --box-shadow: var(--ep-ring-accent), 0 0 0 3px color-mix(in srgb, var(--ion-color-primary, #3880ff) 25%, transparent); }
/* Ionic's inner input and clear button keep the browser's own line height, font and cursor, which
   normalize.css and Tailwind's preflight would change. */
:where(.data-table__search) .searchbar-input { line-height: normal; }
:where(.data-table__search) .searchbar-clear-button { font: revert; cursor: revert; }
</style>
