<script setup lang="ts">
// The figure card: a label, a big value and its icon, with an optional note and trend, in one of the six colours of
// data. A status («Sold out») is a StatusPill of its own tone in place of the trend: the figure keeps its colour. Its look is the theme sheet stat-card.css, so the brandbook paints it with the same rules.
//   <div class="ep-stat-grid">
//     <StatCard :label="t('home.sales')" :value="formatMoney(total, locale, money)" icon="ion:wallet-outline"
//               :tone="1" variant="live" :trend="{ direction: 'up', label: t('home.salesUp', { n }) }"
//               :sparkline="salesByHour" to="/sales" />
//   </div>
// The page formats the value; no value is the empty state. While loading and on error the card opens nothing: on
// error its own action is Retry (`retry`). The lively variant only paints a figure; the other states keep the surface.
import { IonButton, IonSkeletonText } from '@ionic/vue';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { type RouteLocationRaw, RouterLink } from 'vue-router';

import HubIcon from '../../shell/HubIcon.vue';
import { sparkPoints } from '../Chart/scale';
import StatusPill from '../StatusPill/StatusPill.vue';
import en from './locales/en.json';
import es from './locales/es.json';
import type {
  StatCardStatus,
  StatCardStatusTone,
  StatCardTone,
  StatCardTrend,
  StatCardTrendDirection,
  StatCardTrendTone,
  StatCardVariant,
} from './types';

const props = withDefaults(
  defineProps<{
    /** What the figure measures («Sales today»). */
    label: string;
    /** The figure, already formatted by the page; none (or blank) is the empty state. */
    value?: string | null;
    /** `set:name` of a registered icon. */
    icon: string;
    tone?: StatCardTone;
    variant?: StatCardVariant;
    /** A line under the label: the period, what is included. */
    note?: string;
    trend?: StatCardTrend;
    /** Something about the figure apart from its value, shown in place of the trend. */
    status?: StatCardStatus;
    /** The figure's recent values, oldest first, drawn as a line under it; its meaning is the figure and the trend. */
    sparkline?: readonly number[];
    /** Where the whole card leads. */
    to?: RouteLocationRaw;
    loading?: boolean;
    /** The figure could not be loaded: the card says so and offers Retry. */
    error?: boolean;
    /** The page's own words for no data; by default «No data for this period». */
    emptyLabel?: string;
    testid?: string;
  }>(),
  {
    value: null,
    tone: 1,
    variant: 'soft',
    note: undefined,
    trend: undefined,
    status: undefined,
    sparkline: undefined,
    to: undefined,
    loading: false,
    error: false,
    emptyLabel: undefined,
    testid: undefined,
  },
);

const emit = defineEmits<{ retry: [] }>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });

const TREND_ICONS: Record<StatCardTrendDirection, string> = {
  up: 'ion:trending-up-outline',
  down: 'ion:trending-down-outline',
  flat: 'ion:remove-outline',
};
const TREND_TONES: Record<StatCardTrendDirection, StatCardTrendTone> = { up: 'success', down: 'danger', flat: 'neutral' };
const STATUS_ICONS: Record<StatCardStatusTone, string> = {
  success: 'ion:checkmark-circle-outline',
  warning: 'ion:warning-outline',
  danger: 'ion:alert-circle-outline',
};

const state = computed(() => {
  if (props.loading) return 'loading';
  if (props.error) return 'error';
  return props.value?.trim() ? 'ready' : 'empty';
});
const linked = computed(() => Boolean(props.to) && (state.value === 'ready' || state.value === 'empty'));
const live = computed(() => props.variant === 'live' && state.value === 'ready');
const trendTone = computed(() => props.trend && (props.trend.tone ?? TREND_TONES[props.trend.direction]));
const spark = computed(() => (state.value === 'ready' && props.sparkline ? sparkPoints(props.sparkline) : ''));
const busyLabel = computed(() => (state.value === 'loading' ? t('statCard.loading', { label: props.label }) : undefined));
</script>

<template>
  <component
    :is="linked ? RouterLink : 'article'"
    v-bind="linked ? { to } : {}"
    class="ep-stat-card ep-surface"
    :class="{ 'ep-stat-card--live': live, 'ep-stat-card--soft': !live, 'ep-stat-card--link': linked }"
    :data-tone="tone"
    :data-state="state"
    :data-testid="testid"
    :aria-busy="state === 'loading' ? 'true' : undefined"
    :aria-label="busyLabel"
  >
    <template v-if="state === 'loading'">
      <div class="ep-stat-card__head">
        <IonSkeletonText
          animated
          class="ep-stat-card__bone ep-stat-card__bone--icon"
        />
        <IonSkeletonText
          animated
          class="ep-stat-card__bone ep-stat-card__bone--label"
        />
      </div>
      <IonSkeletonText
        animated
        class="ep-stat-card__bone ep-stat-card__bone--value"
      />
      <IonSkeletonText
        animated
        class="ep-stat-card__bone ep-stat-card__bone--line"
      />
    </template>
    <template v-else>
      <div class="ep-stat-card__head">
        <span class="ep-icon-tile ep-stat-card__icon"><HubIcon :name="icon" /></span>
        <span class="ep-stat-card__heading">
          <span class="ep-stat-card__label">{{ label }}</span>
          <span
            v-if="note"
            class="ep-stat-card__note"
          >{{ note }}</span>
        </span>
        <HubIcon
          v-if="linked"
          class="ep-stat-card__chevron"
          name="ion:chevron-forward-outline"
        />
      </div>
      <p
        v-if="state === 'ready'"
        class="ep-stat-card__value"
      >
        {{ value }}
      </p>
      <p
        v-else
        class="ep-stat-card__value"
        aria-hidden="true"
      >
        —
      </p>
      <div
        v-if="state === 'error'"
        class="ep-stat-card__meta ep-stat-card__error"
        role="status"
      >
        <HubIcon name="ion:cloud-offline-outline" />
        <span class="ep-stat-card__text">{{ t('statCard.error') }}</span>
        <IonButton
          fill="clear"
          class="ep-stat-card__retry"
          @click="emit('retry')"
        >
          {{ t('statCard.retry') }}
        </IonButton>
      </div>
      <p
        v-else-if="state === 'empty'"
        class="ep-stat-card__meta ep-stat-card__empty"
      >
        {{ emptyLabel || t('statCard.empty') }}
      </p>
      <p
        v-else-if="status"
        class="ep-stat-card__meta ep-stat-card__status"
      >
        <StatusPill
          :tone="status.tone"
          :label="status.label"
          :icon="STATUS_ICONS[status.tone]"
        />
      </p>
      <p
        v-else-if="trend"
        class="ep-stat-card__meta ep-stat-card__trend"
        :data-trend="trendTone"
      >
        <HubIcon
          :name="TREND_ICONS[trend.direction]"
          :label="t(`statCard.trend.${trend.direction}`)"
        />
        <span class="ep-stat-card__text">{{ trend.label }}</span>
      </p>
      <svg
        v-if="spark"
        class="ep-stat-card__spark"
        viewBox="0 0 100 32"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          :points="spark"
          vector-effect="non-scaling-stroke"
        />
      </svg>
    </template>
  </component>
</template>
