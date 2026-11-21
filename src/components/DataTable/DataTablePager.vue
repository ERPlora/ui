<script setup lang="ts">
// The table's footer: what it counts and, on a desk or on a phone past its window, the page buttons.
import { IonButton, IonIcon, IonSelect, IonSelectOption } from '@ionic/vue';
import { computed } from 'vue';

import { entityWord, pageList, type PagerState } from './pager';
import type { DataTableEntityLabel, DataTableLabels } from './types';
import { usePartChrome } from './usePartChrome';

const props = withDefaults(
  defineProps<{
    pager: PagerState<unknown>;
    /** The rows load at the end of their scroll (the cards, a phone's list) instead of paging. */
    windowed: boolean;
    /** Windowed in server mode with a query longer than the parent's window: previous / next instead. */
    phonePaged: boolean;
    /** The first rows are loading: nothing to count yet. */
    awaitingRows: boolean;
    /** The rows-per-page select is here, as no toolbar carries it. */
    sizeSelect: boolean;
    pageSize: number;
    pageSizeOptions: number[];
    entityLabel?: DataTableEntityLabel;
    labels?: Partial<DataTableLabels>;
    testid?: string;
  }>(),
  { entityLabel: undefined, labels: undefined, testid: undefined },
);

const emit = defineEmits<{ go: [page: number]; pageSize: [size: number] }>();

const { ICONS, icon, label, tid } = usePartChrome(props);
const goTo = (page: number): void => emit('go', page);
const onPageSizeSelect = (ev: CustomEvent<{ value?: unknown }>): void => emit('pageSize', Number(ev.detail.value));

const pagerFrom = computed(() => label('showing', { from: props.pager.rangeFrom, to: props.pager.rangeTo }));
/** «Showing 1–20 of»: a page of several, or a window still growing; once every row is there, only the count. */
const showRange = computed(() => !props.awaitingRows && (props.windowed && !props.phonePaged ? props.pager.canLoadMore : props.pager.pages > 1));
const recordWord = computed(
  () => entityWord(props.pager.count, props.entityLabel) ?? label(props.pager.count === 1 ? 'recordSingular' : 'recordPlural'),
);
</script>

<template>
  <div :class="['data-table__pager', { 'data-table__pager--phone-pages': phonePaged }]">
    <div class="data-table__pager-info">
      <span>
        <template v-if="showRange">{{ `${pagerFrom} ` }}</template>
        <template v-if="!awaitingRows"><span class="data-table__pager-count">{{ pager.count }}</span>{{ ` ${recordWord}` }}</template>
      </span>
      <ion-select
        v-if="sizeSelect"
        class="data-table__pager-size"
        interface="popover"
        :aria-label="label('rowsPerPage')"
        :value="pageSize"
        :selected-text="label('perPageShort', { n: pageSize })"
        @ion-change="onPageSizeSelect"
      >
        <ion-select-option
          v-for="size in pageSizeOptions"
          :key="size"
          :value="size"
        >
          {{ label('perPageShort', { n: size }) }}
        </ion-select-option>
      </ion-select>
    </div>
    <!-- Windowed rows load at the end of their scroll; past `maxWindow`, previous / next. -->
    <div
      v-if="phonePaged && pager.pages > 1 && !awaitingRows"
      class="data-table__pager-nav"
    >
      <ion-button
        size="small"
        fill="clear"
        :data-testid="tid('page-prev')"
        :aria-label="label('previousPage')"
        :disabled="pager.current === 0"
        @click="goTo(pager.current - 1)"
      >
        <ion-icon
          slot="icon-only"
          :icon="icon(ICONS.previous)"
          aria-hidden="true"
        />
      </ion-button>
      <span class="data-table__page-of">{{ pager.current + 1 }} / {{ pager.pages }}</span>
      <ion-button
        size="small"
        fill="clear"
        :data-testid="tid('page-next')"
        :aria-label="label('nextPage')"
        :disabled="pager.current >= pager.pages - 1"
        @click="goTo(pager.current + 1)"
      >
        <ion-icon
          slot="icon-only"
          :icon="icon(ICONS.next)"
          aria-hidden="true"
        />
      </ion-button>
    </div>
    <div
      v-else-if="!windowed && pager.pages > 1 && !awaitingRows"
      class="data-table__pager-nav"
    >
      <ion-button
        size="small"
        fill="clear"
        :data-testid="tid('page-prev')"
        :aria-label="label('previousPage')"
        :disabled="pager.current === 0"
        @click="goTo(pager.current - 1)"
      >
        <ion-icon
          slot="icon-only"
          :icon="icon(ICONS.previous)"
          aria-hidden="true"
        />
      </ion-button>
      <template
        v-for="(entry, index) in pageList(pager.current + 1, pager.pages)"
        :key="`${entry}-${index}`"
      >
        <span
          v-if="entry === '…'"
          class="data-table__page-gap"
        >…</span>
        <ion-button
          v-else
          fill="clear"
          :class="['data-table__page', { 'data-table__page--current': entry === pager.current + 1 }]"
          :aria-label="label('pageNumber', { page: entry })"
          :aria-current="entry === pager.current + 1 ? 'page' : undefined"
          @click="goTo(entry - 1)"
        >
          {{ entry }}
        </ion-button>
      </template>
      <ion-button
        size="small"
        fill="clear"
        :data-testid="tid('page-next')"
        :aria-label="label('nextPage')"
        :disabled="pager.current >= pager.pages - 1"
        @click="goTo(pager.current + 1)"
      >
        <ion-icon
          slot="icon-only"
          :icon="icon(ICONS.next)"
          aria-hidden="true"
        />
      </ion-button>
    </div>
  </div>
</template>

<style scoped src="./controls.css"></style>

<style scoped>
@media (pointer: coarse), (max-width: 834px) {
  .data-table__pager-nav ion-button { min-width: 44px; min-height: 44px; margin: 0; }
}

/* ── Footer: count + paging ──────────────────────────────────────────────────────────────── */
.data-table__pager { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-top: auto; padding: 0.55rem 1rem; border-top: 1px solid var(--border-color); background: var(--header-background); font-size: 12.5px; color: var(--color-muted); }
.data-table__pager-info { display: flex; align-items: center; gap: 0.6rem; }
.data-table__pager-count { font-weight: 600; color: var(--color); }
.data-table__pager-size { font: inherit; font-size: 12.5px; padding: 0.2rem 0.35rem; border: 1px solid var(--border-color); border-radius: 6px; background: var(--background); color: var(--color); }
.data-table__pager-nav { display: flex; align-items: center; gap: 0.2rem; }
/* A phone past `maxWindow`: previous / next and «page / pages»; the nav takes its own line if the count needs it. */
.data-table__pager--phone-pages { flex-wrap: wrap; row-gap: 0.25rem; }
.data-table__pager--phone-pages .data-table__pager-nav { margin-inline-start: auto; }
.data-table__page-of { min-width: 4.5rem; text-align: center; font-weight: 600; color: var(--color); white-space: nowrap; }
/* A page button matches the 44px of prev/next. */
.data-table__page { min-width: var(--ep-tap-min, 44px); height: var(--ep-tap-min, 44px); padding: 0 0.4rem; border: 1px solid transparent; border-radius: 8px; background: none; font: inherit; font-size: 12.5px; font-weight: 600; color: var(--color); cursor: pointer; transition: background 0.12s, border-color 0.12s; }
.data-table__page:hover { background: var(--row-hover); }
.data-table__page.data-table__page--current { background: color-mix(in srgb, var(--primary) 14%, transparent); color: var(--primary); border-color: color-mix(in srgb, var(--primary) 40%, transparent); }
.data-table__page-gap { padding: 0 0.15rem; color: var(--color-muted); }

.data-table__pager-nav > ion-button.data-table__page {
  margin: 0;
  --background: transparent;
  --color: var(--color);
  --border-radius: 8px;
  --padding-start: 0.4rem;
  --padding-end: 0.4rem;
}
.data-table__pager-nav > ion-button.data-table__page.data-table__page--current {
  --background: color-mix(in srgb, var(--primary) 12%, transparent);
  --color: var(--primary);
  --border-color: color-mix(in srgb, var(--primary) 32%, transparent);
}
.data-table > .data-table__surface > .data-table__pager > .data-table__pager-info > .data-table__pager-size {
  min-height: 44px;
}
</style>
