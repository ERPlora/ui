<script setup lang="ts">
// DataTableLookup — the `lookup` column filter: one choice among more than a list can hold (staff, roles,
// accounts…), inside the table's filters panel or filter row, with no dialog of its own (the Hub's
// SearchSelect filters, FIX-DATATABLE). It names the current choice, with a button that clears it; a search
// box asks the page's `load` for the first matches when the person comes to it and for what they type
// (300 ms after the last key), and lists them; a pick emits the value with its label and folds the list.
// A load in flight says so, an empty answer says nothing matched, a failure says so with «Retry» (the same
// text again); a late answer to an older text never replaces a newer one. `errorText` (what the server
// refused, a 422) is painted under the field and tied to the search box.
// Hooks (`testid`): the group itself, `-chosen`, `-clear`, `-search`, `-option` (`data-value`),
// `-loading`, `-empty`, `-error`, `-retry`, `-field-error`.
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonSearchbar, IonSpinner } from '@ionic/vue';
import { computed, ref, shallowRef, useId } from 'vue';

import { ionIconSrc } from '../../shell/icons';
import { useDataTableLabels } from './labels';
import { DATA_TABLE_ICONS } from './model';
import type { DataTableFilterOption, DataTableLabels } from './types';

const props = withDefaults(
  defineProps<{
    /** The field's name (its column), and the group's accessible name. */
    label: string;
    /** The current choice; `''` = none. */
    value: string;
    /** The label of the current choice; without it the value itself is shown. */
    display?: string;
    /** The first matches of what is typed, from the server. */
    load: (query: string) => Promise<DataTableFilterOption[]>;
    /** What the server refused: painted under the field. */
    errorText?: string;
    /** The table's own text overrides. */
    labels?: Partial<DataTableLabels>;
    /** Prefix of the hooks. */
    testid?: string;
  }>(),
  { display: undefined, errorText: undefined, labels: undefined, testid: undefined },
);

const emit = defineEmits<{
  /** A pick (its value and label) or a clear (`''`, `''`). */
  change: [value: string, label: string];
}>();

const { text: t } = useDataTableLabels(() => props.labels);
const errorId = useId();
const tid = (suffix = ''): string | undefined => (props.testid ? `${props.testid}${suffix}` : undefined);

const query = ref('');
const found = shallowRef<DataTableFilterOption[]>([]);
/** Something was asked since the last pick: the list (or its state) is shown. */
const asked = ref(false);
const loading = ref(false);
const failed = ref(false);
/** Each question retires the answers of the previous ones. */
let ticket = 0;

const shown = computed(() => props.display || props.value);

async function ask(text: string): Promise<void> {
  const mine = ++ticket;
  query.value = text;
  asked.value = true;
  loading.value = true;
  failed.value = false;
  try {
    const options = await props.load(text.trim());
    if (mine === ticket) found.value = options;
  } catch {
    if (mine === ticket) {
      found.value = [];
      failed.value = true;
    }
  } finally {
    if (mine === ticket) loading.value = false;
  }
}

/** The person comes to the search box: the first matches, once (until a pick folds them). */
function onFocus(): void {
  if (!asked.value) void ask('');
}

function onInput(ev: CustomEvent<{ value?: string | null }>): void {
  void ask(String(ev.detail.value ?? ''));
}

function pick(option: DataTableFilterOption): void {
  ticket += 1;
  asked.value = false;
  loading.value = false;
  failed.value = false;
  found.value = [];
  query.value = '';
  emit('change', option.value, option.label);
}
</script>

<template>
  <div
    class="data-table-lookup"
    role="group"
    :aria-label="label"
    :data-testid="tid()"
  >
    <span
      class="data-table-lookup__label"
      aria-hidden="true"
    >{{ label }}</span>
    <div
      v-if="value"
      class="data-table-lookup__chosen"
    >
      <span
        class="data-table-lookup__chosen-text"
        :data-testid="tid('-chosen')"
      >{{ shown }}</span>
      <ion-button
        fill="clear"
        size="small"
        :aria-label="t('lookupClear', { label })"
        :data-testid="tid('-clear')"
        @click="emit('change', '', '')"
      >
        <ion-icon
          slot="icon-only"
          :icon="ionIconSrc(DATA_TABLE_ICONS.clear)"
          aria-hidden="true"
        />
      </ion-button>
    </div>
    <ion-searchbar
      class="data-table-lookup__search ion-no-border"
      :value="query"
      :placeholder="t('search')"
      :debounce="300"
      :aria-describedby="errorText ? errorId : undefined"
      :data-testid="tid('-search')"
      @ion-focus="onFocus"
      @ion-input="onInput"
    />
    <template v-if="asked">
      <p
        v-if="failed"
        class="data-table-lookup__state data-table-lookup__state--error"
        role="alert"
        :data-testid="tid('-error')"
      >
        {{ t('loadError') }}
        <ion-button
          fill="clear"
          size="small"
          :data-testid="tid('-retry')"
          @click="ask(query)"
        >
          {{ t('retry') }}
        </ion-button>
      </p>
      <p
        v-else-if="loading && !found.length"
        class="data-table-lookup__state"
        role="status"
        :data-testid="tid('-loading')"
      >
        <ion-spinner
          name="crescent"
          aria-hidden="true"
        />
        {{ t('loading') }}
      </p>
      <p
        v-else-if="!found.length"
        class="data-table-lookup__state"
        :data-testid="tid('-empty')"
      >
        {{ t('lookupEmpty') }}
      </p>
      <ion-list
        v-else
        class="data-table-lookup__list"
        lines="none"
      >
        <ion-item
          v-for="option in found"
          :key="option.value"
          :button="true"
          :detail="false"
          :aria-current="option.value === value ? 'true' : undefined"
          :data-value="option.value"
          :data-testid="tid('-option')"
          @click="pick(option)"
        >
          <ion-label>{{ option.label }}</ion-label>
        </ion-item>
      </ion-list>
    </template>
    <p
      v-if="errorText"
      :id="errorId"
      class="data-table-lookup__error"
      :data-testid="tid('-field-error')"
    >
      {{ errorText }}
    </p>
  </div>
</template>

<style scoped>
.data-table-lookup { display: flex; flex-direction: column; gap: 0.45rem; min-width: 12rem; }
.data-table-lookup__label { font-size: 13px; font-weight: 500; color: var(--color, inherit); }
.data-table-lookup__chosen { display: flex; align-items: center; justify-content: space-between; gap: 0.4rem; min-height: 38px; padding: 0 0.25rem 0 0.75rem; border: 1px solid var(--control-border, rgba(0, 0, 0, 0.2)); border-radius: 10px; font-size: 14px; }
.data-table-lookup__chosen-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.data-table-lookup__chosen ion-button { margin: 0; }
.data-table-lookup__search { padding: 0; min-height: 36px; --border-radius: 10px; }
.data-table-lookup__state { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 13px; color: var(--color-muted, inherit); }
.data-table-lookup__state ion-spinner { width: 18px; height: 18px; }
.data-table-lookup__state--error { color: var(--ion-color-danger, #c5000f); }
.data-table-lookup__state--error ion-button { margin: 0; }
.data-table-lookup__list { padding: 0; max-height: 15rem; overflow: auto; border: 1px solid var(--border-color, rgba(0, 0, 0, 0.12)); border-radius: 10px; }
.data-table-lookup__list ion-item { --min-height: 40px; font-size: 14px; }
.data-table-lookup__list ion-item[aria-current='true'] { font-weight: 600; --color: var(--ion-color-primary, #3880ff); }
.data-table-lookup__error { margin: 0; font-size: 12px; color: var(--ion-color-danger, #c5000f); }
</style>
