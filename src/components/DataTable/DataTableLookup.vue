<script setup lang="ts">
// DataTableLookup — the `lookup` column filter: one choice among more than a list can hold (staff, roles,
// accounts…), inside the table's filters panel or filter row, with no dialog of its own (the Hub's
// SearchSelect filters, FIX-DATATABLE). It names the current choice, with a button that clears it; a search
// box asks the page's `load` for the first matches when the person comes to it and for what they type
// (`debounce` ms after the last key), and lists them; a pick emits the value with its label and folds the
// list. A load in flight says so, an empty answer says nothing matched, a failure says so with «Retry» (the
// same text again); a late answer to an older text never replaces a newer one. `errorText` (what the server
// refused, a 422) is painted under the field and tied to the search box.
// Keyboard and assistive tech (WAI-ARIA APG «combobox with listbox popup»): the search box is a native
// input with `role="combobox"` (an Ionic field would keep a changing aria-expanded/-activedescendant on its
// host), expanded while options are listed; ArrowDown/ArrowUp move the active option, Enter picks it,
// Escape folds an open list and stops there (a folded list leaves Escape to the panel, which closes).
// The active option is brought into view: the list scrolls past 15rem.
// Hooks (`testid`): the group itself, `-chosen`, `-clear`, `-search`, `-option` (`data-value`),
// `-loading`, `-empty`, `-error`, `-retry`, `-field-error`.
import { IonButton, IonIcon, IonSpinner } from '@ionic/vue';
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, useId } from 'vue';

import { ionIconSrc } from '../../shell/icons';
import { useDataTableLabels } from './labels';
import { DATA_TABLE_ICONS } from './model';
import type { DataTableFilterOption, DataTableLabels } from './types';

const props = withDefaults(
  defineProps<{
    /** The field's name (its column): the search box's label and the group's accessible name. */
    label: string;
    /** The current choice; `''` = none. */
    value: string;
    /** The label of the current choice; without it the value itself is shown. */
    display?: string;
    /** The first matches of what is typed, from the server. */
    load: (query: string) => Promise<DataTableFilterOption[]>;
    /** What the server refused: painted under the field. */
    errorText?: string;
    /** Milliseconds after the last key before asking (300). */
    debounce?: number;
    /** The table's own text overrides. */
    labels?: Partial<DataTableLabels>;
    /** Prefix of the hooks. */
    testid?: string;
  }>(),
  { display: undefined, errorText: undefined, debounce: 300, labels: undefined, testid: undefined },
);

const emit = defineEmits<{
  /** A pick (its value and label) or a clear (`''`, `''`). */
  change: [value: string, label: string];
}>();

const { text: t } = useDataTableLabels(() => props.labels);
const inputId = useId();
const listId = useId();
const errorId = useId();
const tid = (suffix = ''): string | undefined => (props.testid ? `${props.testid}${suffix}` : undefined);
const optionId = (index: number): string => `${listId}-${index}`;

const query = ref('');
const found = shallowRef<DataTableFilterOption[]>([]);
/** Something was asked since the last pick: the list (or its state) is shown. */
const asked = ref(false);
const loading = ref(false);
const failed = ref(false);
/** The option the arrows point at; -1 = none. */
const active = ref(-1);
/** Each question retires the answers of the previous ones. */
let ticket = 0;
let typing: ReturnType<typeof setTimeout> | undefined;

const shown = computed(() => props.display || props.value);
/** The listbox is on screen. */
const expanded = computed(() => asked.value && !failed.value && found.value.length > 0);

async function ask(text: string): Promise<void> {
  const mine = ++ticket;
  query.value = text;
  asked.value = true;
  loading.value = true;
  failed.value = false;
  active.value = -1;
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

/** The person comes to the search box: the matches for what it holds (the first ones when empty), once
 *  (until a pick or Escape folds them; Escape keeps the text). */
function onFocus(): void {
  if (!asked.value) void ask(query.value);
}

function onInput(ev: Event): void {
  const text = (ev.target as HTMLInputElement).value;
  query.value = text;
  clearTimeout(typing);
  if (props.debounce > 0) typing = setTimeout(() => void ask(text), props.debounce);
  else void ask(text);
}

function fold(): void {
  ticket += 1;
  clearTimeout(typing);
  asked.value = false;
  loading.value = false;
  failed.value = false;
  found.value = [];
  active.value = -1;
}

function pick(option: DataTableFilterOption): void {
  fold();
  query.value = '';
  emit('change', option.value, option.label);
}

async function onKeydown(ev: KeyboardEvent): Promise<void> {
  if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
    ev.preventDefault();
    if (!asked.value) await ask(query.value);
    const last = found.value.length - 1;
    if (last < 0) return;
    active.value = ev.key === 'ArrowDown' ? Math.min(active.value + 1, last) : Math.max(active.value - 1, 0);
    // The list scrolls (15rem): the option the arrows reach comes into view.
    await nextTick();
    document.getElementById(optionId(active.value))?.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (ev.key === 'Enter' && expanded.value && active.value >= 0) {
    ev.preventDefault();
    pick(found.value[active.value]);
    return;
  }
  if (ev.key === 'Escape' && asked.value) {
    ev.preventDefault();
    fold();
  }
}

onBeforeUnmount(() => clearTimeout(typing));
</script>

<template>
  <div
    class="data-table-lookup"
    role="group"
    :aria-label="label"
    :data-testid="tid()"
  >
    <label
      class="data-table-lookup__label"
      :for="inputId"
    >{{ label }}</label>
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
    <input
      :id="inputId"
      class="data-table-lookup__search"
      type="search"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-expanded="expanded ? 'true' : 'false'"
      :aria-controls="listId"
      :aria-activedescendant="expanded && active >= 0 ? optionId(active) : undefined"
      :aria-describedby="errorText ? errorId : undefined"
      :aria-invalid="errorText ? 'true' : undefined"
      :value="query"
      :placeholder="t('search')"
      :data-testid="tid('-search')"
      @focus="onFocus"
      @input="onInput"
      @keydown="onKeydown"
    >
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
    </template>
    <ul
      v-show="expanded"
      :id="listId"
      class="data-table-lookup__list"
      role="listbox"
      :aria-label="label"
    >
      <li
        v-for="(option, index) in expanded ? found : []"
        :id="optionId(index)"
        :key="option.value"
        role="option"
        :aria-selected="option.value === value ? 'true' : 'false'"
        :class="['data-table-lookup__option', { 'data-table-lookup__option--active': index === active }]"
        :data-value="option.value"
        :data-testid="tid('-option')"
        @mousedown.prevent
        @click="pick(option)"
      >
        {{ option.label }}
      </li>
    </ul>
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
/* The search box: Ionic's grey searchbar field, as the table's own search. */
.data-table-lookup__search { box-sizing: border-box; width: 100%; min-height: 38px; padding: 0 0.75rem; border: 0; border-radius: 10px; font: inherit; font-size: 14px; color: var(--color, inherit); background: var(--ion-color-step-50, rgba(118, 118, 128, 0.12)); }
.data-table-lookup__search:focus-visible { outline: 2px solid var(--ion-color-primary, #3880ff); outline-offset: 1px; }
.data-table-lookup__search[aria-invalid='true'] { box-shadow: inset 0 0 0 1px var(--ion-color-danger, #c5000f); }
.data-table-lookup__state { display: flex; align-items: center; gap: 0.5rem; margin: 0; font-size: 13px; color: var(--color-muted, inherit); }
.data-table-lookup__state ion-spinner { width: 18px; height: 18px; }
.data-table-lookup__state--error { color: var(--ion-color-danger, #c5000f); }
.data-table-lookup__state--error ion-button { margin: 0; }
.data-table-lookup__list { margin: 0; padding: 0.25rem 0; list-style: none; max-height: 15rem; overflow: auto; border: 1px solid var(--border-color, rgba(0, 0, 0, 0.12)); border-radius: 10px; }
.data-table-lookup__option { min-height: 40px; display: flex; align-items: center; padding: 0 0.75rem; font-size: 14px; cursor: pointer; }
.data-table-lookup__option:hover, .data-table-lookup__option--active { background: var(--ion-color-step-50, rgba(0, 0, 0, 0.05)); }
.data-table-lookup__option[aria-selected='true'] { font-weight: 600; color: var(--ion-color-primary, #3880ff); }
.data-table-lookup__error { margin: 0; font-size: 12px; color: var(--ion-color-danger, #c5000f); }
</style>
