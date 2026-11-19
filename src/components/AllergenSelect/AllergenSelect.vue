<script setup lang="ts">
import { IonCheckbox, IonItem, IonList, IonNote } from '@ionic/vue';
import { computed, useId } from 'vue';

import { useComponentLocale } from '../locale';
import { ALLERGEN_CODES, type AllergenCode, allergenName } from './allergens';

const props = withDefaults(
  defineProps<{
    label: string;
    helperText?: string;
    errorText?: string;
    disabled?: boolean;
    testid?: string;
  }>(),
  { helperText: undefined, errorText: undefined, disabled: false, testid: undefined },
);
const model = defineModel<AllergenCode[]>({ default: () => [] });
const locale = useComponentLocale();
const id = useId();
const helperId = `allergen-helper-${id}`;
const errorId = `allergen-error-${id}`;
const selected = computed(() => new Set(model.value));
const options = computed(() => ALLERGEN_CODES.map((code) => ({ code, name: allergenName(code, locale.value) })));
const describedBy = computed(() =>
  [props.helperText ? helperId : '', props.errorText ? errorId : ''].filter(Boolean).join(' ') || undefined,
);

function toggle(code: AllergenCode, event: CustomEvent<{ checked: boolean }>): void {
  if (props.disabled) return;
  const next = new Set(model.value);
  if (event.detail.checked) next.add(code);
  else next.delete(code);
  model.value = ALLERGEN_CODES.filter((candidate) => next.has(candidate));
}
</script>

<template>
  <fieldset
    class="allergen-select"
    :aria-describedby="describedBy"
    :data-testid="testid"
  >
    <legend class="allergen-select__label">
      {{ label }}
    </legend>
    <ion-note
      v-if="helperText"
      :id="helperId"
      class="allergen-select__helper"
    >
      {{ helperText }}
    </ion-note>
    <ion-list
      class="allergen-select__list"
      lines="none"
    >
      <ion-item
        v-for="option in options"
        :key="option.code"
        class="allergen-select__item"
        :data-testid="testid ? `${testid}-${option.code}` : undefined"
      >
        <ion-checkbox
          label-placement="end"
          justify="start"
          :checked="selected.has(option.code)"
          :disabled="disabled"
          @ion-change="toggle(option.code, $event)"
        >
          {{ option.name }}
        </ion-checkbox>
      </ion-item>
    </ion-list>
    <ion-note
      v-if="errorText"
      :id="errorId"
      class="allergen-select__error"
      color="danger"
    >
      {{ errorText }}
    </ion-note>
  </fieldset>
</template>

<style scoped>
.allergen-select {
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.allergen-select__label {
  padding: 0;
  color: var(--ion-text-color);
  font-size: 0.95rem;
  font-weight: 600;
}
.allergen-select__helper,
.allergen-select__error {
  display: block;
  margin-block-start: var(--ep-space-1, 4px);
  line-height: 1.4;
}
.allergen-select__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--ep-space-4, 16px);
  margin: 0;
  padding: 0;
  background: transparent;
}
.allergen-select__item {
  --background: transparent;
  --min-height: var(--ep-tap-min, 44px);
  --padding-start: 0;
  --inner-padding-end: 0;
  --inner-padding-top: 0;
  --inner-padding-bottom: 0;
}
.allergen-select__item ion-checkbox {
  inline-size: 100%;
  font-size: 0.9rem;
}
.allergen-select__item ion-checkbox::part(native):focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 2px;
}
@media (max-width: 420px) {
  .allergen-select__list {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
