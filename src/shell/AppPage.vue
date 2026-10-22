<script setup lang="ts">
// AppPage — the ONE layout of the shell screens (ADR-0045). Ported from ERPlora hub
// `apps/web/src/components/AppPage.vue` (origin/develop): `ion-page` + `AppTopbar` + a single
// `ion-content`, so every view shares the same container, padding and margins and only injects its
// content, and the footer strip of sections (`tabs`, mockups README §3). Over the content, between the
// topbar and the scroller, the project's notice (`createShell({ chrome: { notice } })`, the hub's
// blocking strip, hub#374): there and not inside ion-content because a warning that scrolls away is not
// a warning, and here because every screen shares this layout. Not ported: the offline strip.
//
// Layouts (`contentLayout`): `fluid` (default) puts the view straight in `ion-content`; `detail` wraps it
// in `.hub-detail-shell` (reading, forms, settings); `detail-fill` gives that box the content area's
// height; `fill` is a list page: the `detail-fill` box holds a `.page-fill` stack (polish.css) in which
// what sits above or under the list keeps its height and a DataTable `fill` takes the rest, between the
// topbar and the tabbar, with its toolbar and footer fixed and its rows scrolling inside (Ioan,
// 2026-10-15; on a phone the list grows with its rows instead: one scroll). A page writes only
// `<AppPage content-layout="fill"><DataTable fill … /></AppPage>`.
//
// Slots: default (the view, inside `ion-content`), `actions` (forwarded to the topbar), `footer`
// (after the content: a sheet's action bar, or a view's own `ion-footer > ion-toolbar > ion-segment`).
//
// Section tabbar: `tabs` + `v-model:tab` paint `ion-footer > ion-toolbar > ion-segment.tabbar`, every
// tab with its icon over its label. Tabs with `to` follow the route (the route says which one is
// active; selecting one REPLACES the address, so Back leaves the section instead of walking its
// tabs). The topbar names the active tab after the title («Billing · Invoices»).
import { IonContent, IonFooter, IonLabel, IonPage, IonSegment, IonSegmentButton, IonToolbar } from '@ionic/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import AppTopbar from './AppTopbar.vue';
import HubIcon from './HubIcon.vue';
import { useChromeVisible, useShellConfig } from './shell-config';
import { useSurface } from './surface';
import { bindTabbar, type ShellTab } from './tabbar';
import { bindTabbarPeek } from './tabbar-peek';

const props = withDefaults(
  defineProps<{
    /** Title of the view (to AppTopbar), and its level-1 heading unless `headingOnScreen`. */
    title: string;
    /** Fallback href of Back; when passed the topbar shows Back (detail view). */
    backHref?: string;
    /** Inner layout: fluid for data/tables; `detail`/`detail-fill` for reading, forms and settings;
     *  `fill` for a list page whose DataTable `fill` takes the height left between topbar and tabbar. */
    contentLayout?: 'fluid' | 'detail' | 'detail-fill' | 'fill';
    /** The view already paints its own `<h1>` (hub#794): the toolbar title drops the heading role. */
    headingOnScreen?: boolean;
    /** The sections of the page, painted as the footer tabbar; none = no tabbar. */
    tabs?: ShellTab[];
    /** Accessible name of the tab strip («Billing sections»); default «Sections». */
    tabsLabel?: string;
  }>(),
  { backHref: undefined, contentLayout: 'fluid', headingOnScreen: false, tabs: () => [], tabsLabel: undefined },
);

/** The active tab id (`v-model:tab`); tabs with `to` take it from the route instead. */
const tab = defineModel<string>('tab');

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { isWeb } = useSurface();
const { chrome } = useShellConfig();
const chromeVisible = useChromeVisible();

const visibleTabs = computed(() => props.tabs.filter((item) => !item.webOnly || isWeb.value));
const routeTab = computed(
  () => visibleTabs.value.find((item) => item.to && (route.path === item.to || route.path.startsWith(`${item.to}/`)))?.id,
);
const activeTab = computed(() => routeTab.value ?? tab.value ?? visibleTabs.value[0]?.id);
const section = computed(() => visibleTabs.value.find((item) => item.id === activeTab.value)?.label);

function onTabChange(event: CustomEvent<{ value?: string | number }>): void {
  const id = String(event.detail.value ?? '');
  const target = visibleTabs.value.find((item) => item.id === id);
  if (!target || id === activeTab.value) return;
  tab.value = id;
  if (target.to) void router.replace(target.to);
}

// ── Footer strip wiring (hub#1734, hub#1830) ─────────────────────────────────────────────────────
// `bindTabbar` says WHETHER the strip hides tabs (edge fade), keeps the checked tab in view and
// drags with a mouse; `bindTabbarPeek` sizes the tabs so that on a phone the next one peeks. Wired
// WHEN the strip appears, not only at mount: the tabs (ours or a view's own `#footer`) can arrive
// later, over the network. A DOM observer and not `onUpdated`: the footer renders inside `ion-page`.
const page = ref<{ $el?: HTMLElement } | null>(null);
let unbind: (() => void) | null = null;
/** The strip already wired, so it is never wired twice nor left wired once gone. */
let bound: HTMLElement | null = null;
let observer: MutationObserver | null = null;

function syncTabbar(): void {
  if (bound?.isConnected) return;
  const segment = page.value?.$el?.querySelector<HTMLElement>('ion-footer ion-segment') ?? null;
  unbind?.();
  unbind = null;
  bound = segment;
  if (!segment) return;
  // Unbound in reverse: the peek gives the strip back its stylesheet width before the fade stops.
  const unbindStrip = bindTabbar(segment);
  const unbindPeek = bindTabbarPeek(segment);
  unbind = () => {
    unbindPeek();
    unbindStrip();
  };
}

onMounted(async () => {
  await nextTick();
  syncTabbar();
  const root = page.value?.$el;
  if (!root) return;
  observer = new MutationObserver(syncTabbar);
  observer.observe(root, { childList: true, subtree: true });
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
  unbind?.();
  unbind = null;
  bound = null;
});
</script>

<template>
  <ion-page ref="page">
    <AppTopbar
      :title="title"
      :section="section"
      :back-href="backHref"
      :title-is-heading="!headingOnScreen"
    >
      <template
        v-if="$slots.actions"
        #actions
      >
        <slot name="actions" />
      </template>
    </AppTopbar>

    <div
      v-if="chrome?.notice && chromeVisible"
      class="page-notice"
    >
      <component :is="chrome.notice" />
    </div>

    <!-- fullscreen=false: the ion-content sits STRICTLY between the topbar and the footer (it does not
         scroll behind them). The shell's rounded content card (polish.css) needs it: with fullscreen
         its two top corners hid behind the opaque topbar. -->
    <ion-content
      :fullscreen="false"
      class="ion-padding"
    >
      <div
        v-if="contentLayout !== 'fluid'"
        class="hub-detail-shell"
        :class="{ 'hub-detail-shell--fill': contentLayout === 'detail-fill' || contentLayout === 'fill' }"
      >
        <div
          v-if="contentLayout === 'fill'"
          class="page-fill"
        >
          <slot />
        </div>
        <slot v-else />
      </div>
      <slot v-else />
    </ion-content>

    <slot name="footer" />

    <ion-footer
      v-if="visibleTabs.length"
      class="ion-no-border section-tabbar"
    >
      <ion-toolbar>
        <ion-segment
          class="tabbar"
          :value="activeTab"
          :aria-label="tabsLabel ?? t('tabbar.label')"
          @ion-change="onTabChange"
        >
          <ion-segment-button
            v-for="item in visibleTabs"
            :key="item.id"
            :value="item.id"
            :data-testid="`tab-${item.id}`"
          >
            <HubIcon :name="item.icon" />
            <ion-label>{{ item.label }}</ion-label>
          </ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-footer>
  </ion-page>
</template>
