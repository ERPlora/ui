<script setup lang="ts">
// With none of the fourteen allergens it paints nothing, so a page passes the codes as they come, without a v-if.
//   <AllergenRow :codes="option.allergens" :testid="`option-${option.id}-allergens`" />
//   <AllergenRow :codes="dish.allergens" :name="dish.name" />   → «Paella · Allergens: Fish»
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { formatAllergens } from '../AllergenSelect/allergens';
import { useComponentLocale } from '../locale';
import en from './locales/en.json';
import es from './locales/es.json';

const props = withDefaults(
  defineProps<{
    /** Allergen codes in any order; codes outside the fourteen are left out. */
    codes: readonly string[];
    /** What the allergens belong to, written before them when the row stands apart from its name. */
    name?: string;
    testid?: string;
  }>(),
  { name: undefined, testid: undefined },
);
const { t } = useI18n({ useScope: 'local', messages: { en, es } });
const locale = useComponentLocale();
const names = computed(() => formatAllergens(props.codes, locale.value));
</script>

<template>
  <span
    v-if="names"
    class="allergen-row"
    :data-testid="testid"
  ><span v-if="name">{{ name }} · </span>{{ t('allergenRow.label', { names }) }}</span>
</template>

<style scoped>
.allergen-row {
  display: block;
  margin-block-start: 0.2rem;
  color: var(--ep-text-muted);
  font-size: 0.75rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
</style>
