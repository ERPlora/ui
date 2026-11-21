<script setup lang="ts">
// The frame the three charts share: a figure that shows the drawing (its slot) and the description under it, or else
// its loading, its «no data» or its error with Retry, in that order of precedence. Its look is the theme sheet
// charts.css, so the brandbook paints it with the same rules.
import { IonButton, IonSkeletonText } from '@ionic/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import InlineFeedback from '../InlineFeedback/InlineFeedback.vue';
import en from './locales/en.json';
import es from './locales/es.json';

const props = defineProps<{
  kind: 'bar' | 'line' | 'list';
  /** Whether there is anything to draw. */
  drawable: boolean;
  description?: string;
  loading?: boolean;
  error?: boolean;
  emptyLabel?: string;
  testid?: string;
}>();

const emit = defineEmits<{ retry: [] }>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });

const state = computed(() => {
  if (props.loading) return 'loading';
  if (props.error) return 'error';
  return props.drawable ? 'ready' : 'empty';
});
</script>

<template>
  <figure
    class="ep-chart"
    :data-kind="kind"
    :data-state="state"
    :data-testid="testid"
    :aria-busy="state === 'loading' ? 'true' : undefined"
    :aria-label="state === 'loading' ? t('chart.loading') : undefined"
  >
    <IonSkeletonText
      v-if="state === 'loading'"
      animated
      class="ep-chart__bone"
    />
    <InlineFeedback
      v-else-if="state === 'error'"
      class="ep-chart__error"
      tone="danger"
    >
      {{ t('chart.error') }}
      <template #actions>
        <IonButton
          fill="clear"
          size="small"
          class="ep-chart__retry"
          @click="emit('retry')"
        >
          {{ t('chart.retry') }}
        </IonButton>
      </template>
    </InlineFeedback>
    <p
      v-else-if="state === 'empty'"
      class="ep-chart__empty"
    >
      {{ emptyLabel || t('chart.empty') }}
    </p>
    <template v-else>
      <slot />
      <figcaption
        v-if="description"
        class="ep-chart__caption"
      >
        {{ description }}
      </figcaption>
    </template>
  </figure>
</template>
