<!-- eslint-disable vue/multi-word-component-names -- `<Combo>` is the name the Hub's pages ask for
     (hub-next apps/tax/UI-REQUESTS.md), the `ok-combo` of today; no HTML element is called that. -->
<script setup lang="ts">
// Combo — a field that searches its options while the person types (the `ok-combo` of today; hub-next
// apps/tax/UI-REQUESTS.md: the 249 countries of a tax rule, the categories the server pages):
//   <Combo v-model="country" :label="t('rule.country')" :options="countries" :error-text="fieldErrors.country" />
//   <Combo v-model="category" :label="t('rule.category')" :search="searchCategories" allow-create @create="newCategory" />
// Contract:
//   - The field is an `ion-input` (md, outline, floating label) showing the chosen option's label;
//     `v-model` is the chosen `{ id, label, hint? }` or `null`. Clearable while something is chosen.
//   - The options are a listbox in an `ion-popover` under the field, as wide as it, that never takes
//     the focus from it. A click or ArrowDown opens every option; typing filters them:
//       · static `options`: «contains» on the label and the hint, ignoring case and accents;
//       · `search(query)`: asked 150 ms after the last key (`debounce`), with loading, empty and
//         error (with Retry) states; an answer that arrives after a newer question is dropped.
//   - Keyboard (ARIA combobox, list autocomplete): ArrowDown/ArrowUp move the highlight (wrapping,
//     `aria-activedescendant`), Enter chooses it, Escape and Tab close and put the chosen label back.
//     Enter and Escape on an open list stay here: they never submit or close the dialog around it.
//     With nothing highlighted (the search still loading, no matches, a failed search) Enter does
//     nothing and the list stays: the answer is never chosen behind the person's back. Closed, Enter
//     is the form's (FormModal submits on it).
//   - `allowCreate`: a last option «Create “…”» for a text that names no option; choosing it emits
//     `create` with the text (trimmed) and leaves the typing in the field: the page creates the
//     record and sets `v-model`.
import { IonButton, IonContent, IonInput, IonItem, IonLabel, IonPopover, IonSpinner } from '@ionic/vue';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useId, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';
import en from './locales/en.json';
import es from './locales/es.json';
import type { ComboOption, ComboSearch } from './types';

const props = withDefaults(
  defineProps<{
    /** The chosen option (`v-model`), or `null`. */
    modelValue?: ComboOption | null;
    /** The options, filtered here while typing. Ignored when `search` is given. */
    options?: ComboOption[];
    /** Asks the server for the options of a text (`''` on opening). */
    search?: ComboSearch;
    /** The field's label, and the listbox's name. */
    label?: string;
    placeholder?: string;
    /** What an empty result says (default «No matches»). */
    emptyLabel?: string;
    /** The form's message for this field (a 422): paints the field invalid. */
    errorText?: string;
    helperText?: string;
    /** Offers «Create “…”» for a text that names no option (emits `create`). */
    allowCreate?: boolean;
    /** A Clear button while something is chosen. */
    clearable?: boolean;
    disabled?: boolean;
    /** Milliseconds after the last key before `search` is asked. */
    debounce?: number;
    /** Prefix of the `data-testid` hooks (`<testid>`, `-clear`, `-option-<id>`, `-create`,
     *  `-loading`, `-empty`, `-error`, `-retry`). */
    testid?: string;
  }>(),
  {
    modelValue: null,
    options: () => [],
    search: undefined,
    label: undefined,
    placeholder: undefined,
    emptyLabel: undefined,
    errorText: undefined,
    helperText: undefined,
    allowCreate: false,
    clearable: true,
    disabled: false,
    debounce: 150,
    testid: undefined,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: ComboOption | null];
  /** `allowCreate`: the person chose to create this text. */
  create: [text: string];
}>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });

const base = `ep-combo-${useId()}`;
const listboxId = `${base}-listbox`;
const optionId = (index: number): string => `${base}-option-${index}`;
const tid = (part: string): string | undefined => (props.testid?.trim() ? `${props.testid.trim()}-${part}` : undefined);

/** Lower case without accents: «España» is found by «espa». */
const fold = (value: string): string => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

// ── State ─────────────────────────────────────────────────────────────────────────────────────
const root = ref<HTMLElement | null>(null);
const nativeInput = shallowRef<HTMLInputElement | null>(null);
/** What the field shows: the chosen label, or what the person is typing. */
const text = ref(props.modelValue?.label ?? '');
const open = ref(false);
/** The text the options are filtered or searched by (`''` = all of them). */
const query = ref('');
const found = shallowRef<ComboOption[]>([]);
const loading = ref(false);
const failed = ref(false);
/** The highlighted entry (`-1` = none). */
const active = ref(-1);
/** Where the popover anchors: the field itself (Ionic reads `event.target`). */
const anchor = shallowRef<Event | undefined>(undefined);
let timer: ReturnType<typeof setTimeout> | undefined;
/** Number of the last question to the server: an older answer is dropped. */
let asked = 0;

type Entry = { kind: 'option'; option: ComboOption } | { kind: 'create'; text: string };

const matches = computed<ComboOption[]>(() => {
  if (props.search) return found.value;
  const wanted = fold(query.value.trim());
  if (!wanted) return props.options;
  return props.options.filter((o) => fold(o.label).includes(wanted) || (o.hint !== undefined && fold(o.hint).includes(wanted)));
});
/** The text «Create …» offers: typed, and no option is called that. */
const creatable = computed(() => {
  const typed = query.value.trim();
  if (!props.allowCreate || !typed || loading.value) return '';
  const wanted = fold(typed);
  return matches.value.some((o) => fold(o.label) === wanted) ? '' : typed;
});
const entries = computed<Entry[]>(() => [
  ...matches.value.map((option): Entry => ({ kind: 'option', option })),
  ...(creatable.value ? [{ kind: 'create', text: creatable.value } as Entry] : []),
]);
const canClear = computed(() => props.clearable && !props.disabled && props.modelValue !== null);

// A new list highlights its first entry, so Enter takes the first match.
watch(entries, (list) => {
  active.value = list.length ? 0 : -1;
});

// The page's v-model, painted unless the person is typing.
watch(
  () => props.modelValue,
  (value) => {
    if (!open.value) text.value = value?.label ?? '';
  },
);

// ── The server ────────────────────────────────────────────────────────────────────────────────
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

// ── Opening, choosing, closing ────────────────────────────────────────────────────────────────
const field = (): HTMLElement | null => root.value?.querySelector<HTMLElement>('ion-input') ?? null;

function openList(): void {
  if (props.disabled || open.value) return;
  anchor.value = { target: field() } as unknown as Event;
  open.value = true;
  query.value = '';
  ask('');
  active.value = entries.value.length ? 0 : -1;
}

function onInput(ev: CustomEvent<{ value?: string | null }>): void {
  if (props.disabled) return;
  const value = ev.detail.value ?? '';
  text.value = value;
  query.value = value;
  if (!open.value) {
    anchor.value = { target: field() } as unknown as Event;
    open.value = true;
  }
  ask(value);
}

/** Closes the list; `revert` puts the chosen option's label back in the field. */
function dismiss(revert = true): void {
  if (!open.value) return;
  open.value = false;
  clearTimeout(timer);
  asked += 1;
  loading.value = false;
  query.value = '';
  active.value = -1;
  if (revert) text.value = props.modelValue?.label ?? '';
}

function pick(entry: Entry): void {
  if (entry.kind === 'create') {
    emit('create', entry.text);
    dismiss(false);
    return;
  }
  emit('update:modelValue', entry.option);
  text.value = entry.option.label;
  dismiss(false);
}

function clear(): void {
  emit('update:modelValue', null);
  text.value = '';
  dismiss(false);
}

function move(step: number): void {
  const count = entries.value.length;
  if (!count) return;
  active.value = (((active.value + step) % count) + count) % count;
}

function onKeydown(ev: KeyboardEvent): void {
  if (props.disabled) return;
  switch (ev.key) {
    case 'ArrowDown':
      ev.preventDefault();
      if (open.value) move(1);
      else openList();
      break;
    case 'ArrowUp':
      if (!open.value) return;
      ev.preventDefault();
      move(-1);
      break;
    case 'Enter': {
      // Open, Enter is always the combo's, even with nothing to take (the search still loading, no
      // matches, a failed search): then it does nothing and the list stays, never the form's submit.
      if (!open.value) return;
      ev.preventDefault();
      ev.stopPropagation();
      const entry = entries.value[active.value];
      if (entry) pick(entry);
      break;
    }
    case 'Escape':
      if (!open.value) return;
      ev.preventDefault();
      ev.stopPropagation();
      dismiss();
      break;
    case 'Tab':
      dismiss();
      break;
  }
}

/** Ionic 8's present() blurs whatever has the focus before an overlay shows: the field takes it
 *  back as the popover is about to show, so the next keys still reach it (measured in Chrome). */
function keepFocus(): void {
  const input = nativeInput.value;
  if (input && document.activeElement !== input) input.focus({ preventScroll: true });
}

// ── The native input is the combobox (ARIA) ───────────────────────────────────────────────────
// Ionic renders the `<input>` itself and copies aria-* from its host only once, when it loads: the
// combobox attributes, which change while the list is open, are written on the input directly.
onMounted(async () => {
  const host = field() as (HTMLElement & { getInputElement?: () => Promise<HTMLInputElement> }) | null;
  nativeInput.value = (await host?.getInputElement?.()) ?? null;
});
watchEffect(() => {
  const input = nativeInput.value;
  if (!input) return;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-controls', listboxId);
  input.setAttribute('aria-expanded', open.value ? 'true' : 'false');
  if (open.value && active.value >= 0) input.setAttribute('aria-activedescendant', optionId(active.value));
  else input.removeAttribute('aria-activedescendant');
});
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div
    ref="root"
    class="combo"
  >
    <ion-input
      mode="md"
      fill="outline"
      label-placement="floating"
      :label="label"
      :placeholder="placeholder"
      :value="text"
      :disabled="disabled"
      :error-text="errorText"
      :helper-text="helperText"
      :class="{ 'ion-invalid': !!errorText, 'ion-touched': !!errorText }"
      :data-testid="testid"
      @ion-input="onInput"
      @click="openList"
      @keydown="onKeydown"
    >
      <!-- v-show, not v-if: Stencil's slot patch of ion-input loses itself when a slotted node
           comes and goes. -->
      <ion-button
        v-show="canClear"
        slot="end"
        fill="clear"
        :aria-label="t('combo.clear')"
        :data-testid="tid('clear')"
        @click.stop="clear"
      >
        <HubIcon
          slot="icon-only"
          name="ion:close-circle-outline"
        />
      </ion-button>
    </ion-input>
    <!-- The options, under the field and as wide as it; the focus stays in the field. -->
    <ion-popover
      class="combo__popover"
      :is-open="open"
      :event="anchor"
      side="bottom"
      alignment="start"
      size="cover"
      :keyboard-close="false"
      :focus-trap="false"
      :show-backdrop="false"
      @will-present="keepFocus"
      @did-present="keepFocus"
      @did-dismiss="dismiss()"
    >
      <ion-content>
        <!-- The listbox and its options are plain elements around the ion-items: Ionic writes its
             own role on the host of an ion-list (list) and an ion-item (listitem, or none). -->
        <div
          :id="listboxId"
          class="combo__listbox"
          role="listbox"
          :aria-label="label"
          :aria-busy="loading ? 'true' : undefined"
        >
          <div
            v-for="(entry, index) in entries"
            :id="optionId(index)"
            :key="entry.kind === 'option' ? `option-${entry.option.id}` : 'create'"
            role="option"
            :aria-selected="index === active ? 'true' : 'false'"
            :class="['combo__option', { 'combo__option--active': index === active }]"
            :data-testid="entry.kind === 'option' ? tid(`option-${entry.option.id}`) : tid('create')"
            @mousedown.prevent
            @mouseenter="active = index"
            @click="pick(entry)"
          >
            <ion-item lines="none">
              <ion-label v-if="entry.kind === 'option'">
                {{ entry.option.label }}
                <p v-if="entry.option.hint">
                  {{ entry.option.hint }}
                </p>
              </ion-label>
              <ion-label v-else>
                {{ t('combo.create', { text: entry.text }) }}
              </ion-label>
            </ion-item>
          </div>
        </div>
        <div
          v-if="loading"
          class="combo__status ion-padding"
          role="status"
          :data-testid="tid('loading')"
        >
          <ion-spinner
            name="crescent"
            aria-hidden="true"
          />
          <span>{{ t('combo.loading') }}</span>
        </div>
        <div
          v-else-if="failed"
          class="combo__status ion-padding"
          role="alert"
          :data-testid="tid('error')"
        >
          <span>{{ t('combo.loadError') }}</span>
          <ion-button
            size="small"
            fill="clear"
            :data-testid="tid('retry')"
            @mousedown.prevent
            @click="ask(query)"
          >
            {{ t('combo.retry') }}
          </ion-button>
        </div>
        <div
          v-else-if="!entries.length"
          class="combo__status ion-padding"
          role="status"
          :data-testid="tid('empty')"
        >
          {{ emptyLabel ?? t('combo.empty') }}
        </div>
      </ion-content>
    </ion-popover>
  </div>
</template>

<style scoped>
.combo__option {
  cursor: pointer;
}
/* The highlighted option (arrows, hover): the menu's wash of the primary colour. */
.combo__option--active ion-item {
  --background: color-mix(in oklab, var(--ion-color-primary) 13%, transparent);
}
.combo__status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--ep-text-muted);
  font-size: 0.875rem;
}
.combo__status ion-spinner {
  width: 18px;
  height: 18px;
}
</style>
