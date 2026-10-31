<script setup lang="ts">
// The assistant's panel (APP-BASE-9; the old hub's AssistantDrawer, HUB_SHELL-F185…F199), mounted once beside the
// pane while a person is signed in (the Hub's `chrome.background`, keyed on them), as the host configured the chat
// (`configureAssistant`). On the right: from 768 px it docks beside the
// screen and pushes it (the screen keeps working); on a phone it covers the screen over a veil. It closes with ×,
// Escape, the veil, the topbar's button again or «Go to …»; open or closed is remembered by the device (BASE-G110).
// - Head: «Assistant», «New conversation» once there is one, ×.
// - Thread: the empty conversation — the host's, in the `empty` slot (`{ setup, ask }`; the Hub's setup shortcuts,
//   BASE-G121), else the chat's own sentence —, or the bubbles (BASE-G111, G113, G114, G117, G124), following the
//   answer as it is written.
// - Foot: no connection (BASE-G124), what is left of the month's messages from 80 % or a plan without the assistant
//   (BASE-G122, read once per opening with the host's `usage`; nothing when it cannot be read or the host does not
//   count them), and the composer (BASE-G111, G112).
// - Over everything, even with the panel closed: the card of a write (BASE-G115, G116, G119); the report (BASE-G123),
//   for a host that takes reports.
// «Read aloud» uses the device's own voice; the conversation is this person's (BASE-G120: `forUser`).
import { IonButton } from '@ionic/vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { useLiveClient } from '../../sdk/live-client';
import HubIcon from '../../shell/HubIcon.vue';
import { NOT_FOUND_ROUTE } from '../../shell/router';
import { useSession } from '../../shell/session';
import { useSurface } from '../../shell/surface';
import AssistantComposer from './AssistantComposer.vue';
import AssistantConfirm from './AssistantConfirm.vue';
import AssistantEmpty from './AssistantEmpty.vue';
import AssistantMessage from './AssistantMessage.vue';
import AssistantReport from './AssistantReport.vue';
import { assistantConfig, spentNoteKeyOf } from './config';
import { screenLabel, usageNote } from './guide';
import type { Bubble } from './history';
import { parseMarkdown, spokenText } from './markdown';
import { useAssistant } from './state';

defineSlots<{
  /** The host's empty conversation: `setup` when the panel was opened for the setup; `ask` sends a question. */
  empty?: (scope: { setup: boolean; ask: (text: string, options?: { setup?: boolean }) => void }) => unknown;
}>();

const DOCKED_CLASS = 'assistant-docked';
const WIDE = '(min-width: 768px)';

const { t, locale } = useI18n({ useScope: 'global' });
const config = assistantConfig();
const client = useLiveClient();
const session = useSession();
const { isWeb } = useSurface();
const router = useRouter();
const assistant = useAssistant();
const state = assistant.state;

const thread = useTemplateRef<HTMLElement>('thread');
const reporting = shallowRef<Bubble | null>(null);
const speaking = ref<string | null>(null);

// ── Who, and the screens of this app ──

watch(
  () => session.user.value?.id,
  (id) => {
    if (id) assistant.forUser(id);
  },
  { immediate: true },
);

function screenExists(path: string): boolean {
  try {
    return router.resolve(path).name !== NOT_FOUND_ROUTE.name;
  } catch {
    return false;
  }
}
assistant.setScreenCheck(screenExists);

const nameOf = (path: string) => screenLabel(path, session.menu.value, t, config.screenKey);
const appNameOf = (app: string) => session.menu.value.find((section) => section.id === app)?.label;

const planUrl = config.planUrl?.() ?? '';
// gh:hub#1259: the plan is upgraded by whoever the host says (the Hub: who administers the business), and only on
// the web (it sells).
const canUpgrade = computed(() => isWeb.value && (config.canUpgrade?.(session) ?? false));
const canReport = config.report !== undefined;

// ── Docked or over the screen ──

function media(query: string): MediaQueryList | undefined {
  try {
    return globalThis.matchMedia?.(query);
  } catch {
    return undefined;
  }
}

const wideQuery = media(WIDE);
const wide = ref(wideQuery?.matches ?? true);
const onWide = (event: MediaQueryListEvent) => {
  wide.value = event.matches;
};
wideQuery?.addEventListener?.('change', onWide);

const docked = computed(() => state.open && wide.value);
watch(docked, (on) => document.documentElement.classList.toggle(DOCKED_CLASS, on), { immediate: true });

// ── The connection ──

const offline = ref(globalThis.navigator?.onLine === false);
const onConnection = () => {
  offline.value = globalThis.navigator?.onLine === false;
};
onMounted(() => {
  window.addEventListener('online', onConnection);
  window.addEventListener('offline', onConnection);
  document.addEventListener('keydown', onKeydown);
});

// ── The month's messages (read once per opening) ──

async function readUsage(): Promise<void> {
  if (!config.usage) {
    state.usage = null;
    return;
  }
  try {
    state.usage = await config.usage(client);
  } catch (error) {
    // Never a number made up: without an answer the panel says nothing of the allowance.
    console.warn('assistant: the allowance could not be read', error);
    state.usage = null;
  }
}

const note = computed(() => usageNote(state.usage ?? undefined));
const renews = computed(() => {
  const at = note.value?.resetsAt;
  if (!at) return '';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  return t('assistant.renews', {
    date: new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(date),
  });
});
const usageText = computed(() =>
  note.value
    ? [
        note.value.left > 0
          ? t('assistant.usage', { left: note.value.left, limit: note.value.limit })
          : t('assistant.usageSpent', { limit: note.value.limit }),
        renews.value,
      ]
        .filter(Boolean)
        .join(' ')
    : '',
);
const noPlan = computed(() => state.usage !== null && state.usage.limit <= 0 && !state.usage.demo);

// ── Opening and closing ──

function close(): void {
  assistant.setOpen(false);
}

watch(
  () => state.open,
  (open) => {
    if (!open) return;
    void readUsage();
    void nextTick(() => {
      scrollDown();
      if (!media('(pointer: coarse)')?.matches) {
        const box = thread.value?.closest('.assistant-panel')?.querySelector<HTMLElement & { setFocus?: () => Promise<void> }>(
          'ion-textarea',
        );
        void box?.setFocus?.();
      }
    });
  },
  { immediate: true },
);

/** The overlays whose Escape is their own (the card, the report, a menu): never the panel's. */
const OVERLAYS = 'ion-modal, ion-popover, ion-alert, ion-action-sheet, ion-picker-legacy';

/** Escape closes the panel wherever the focus is (the old panel had no handler), never from a dialog over it. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented || !state.open) return;
  if (event.target instanceof Element && event.target.closest(OVERLAYS)) return;
  event.preventDefault();
  close();
}

// ── The thread ──

function scrollDown(): void {
  const element = thread.value;
  if (element) element.scrollTop = element.scrollHeight;
}

watch(
  () => {
    const last = state.thread.bubbles.at(-1);
    return `${state.thread.bubbles.length}:${last?.text.length ?? 0}:${last?.done ?? true}`;
  },
  () => void nextTick(scrollDown),
);

function ask(text: string, options: { setup?: boolean } = {}): void {
  void assistant.ask(text, options);
}

function go(path: string): void {
  void router.push(path);
  close();
}

function signIn(): void {
  // The session ended: the page again goes through the way in, to the login.
  window.location.reload();
}

// ── Read aloud (the device's voice) ──

const voice = typeof globalThis.speechSynthesis === 'object' && typeof globalThis.SpeechSynthesisUtterance === 'function'
  ? globalThis.speechSynthesis
  : null;

function listen(bubble: Bubble): void {
  if (!voice) return;
  voice.cancel();
  if (speaking.value === bubble.id) {
    speaking.value = null;
    return;
  }
  const utterance = new SpeechSynthesisUtterance(spokenText(parseMarkdown(bubble.text), nameOf));
  utterance.lang = locale.value;
  const done = () => {
    if (speaking.value === bubble.id) speaking.value = null;
  };
  utterance.onend = done;
  utterance.onerror = done;
  speaking.value = bubble.id;
  voice.speak(utterance);
}

onBeforeUnmount(() => {
  wideQuery?.removeEventListener?.('change', onWide);
  window.removeEventListener('online', onConnection);
  window.removeEventListener('offline', onConnection);
  document.removeEventListener('keydown', onKeydown);
  document.documentElement.classList.remove(DOCKED_CLASS);
  if (speaking.value) voice?.cancel();
});
</script>

<template>
  <div
    v-if="state.open && !wide"
    class="assistant-veil"
    data-testid="assistant-veil"
    aria-hidden="true"
    @click="close"
  />
  <aside
    class="assistant-panel"
    data-testid="assistant-panel"
    role="dialog"
    :aria-label="t('assistant.title')"
    :aria-modal="state.open && !wide ? 'true' : undefined"
    :aria-hidden="state.open ? 'false' : 'true'"
    :data-open="state.open ? 'true' : 'false'"
  >
    <template v-if="state.open">
      <header class="assistant-head">
        <h2 class="assistant-title">
          <HubIcon
            class="assistant-title-icon"
            name="ion:sparkles-outline"
          />
          {{ t('assistant.title') }}
        </h2>
        <ion-button
          v-if="state.thread.bubbles.length"
          fill="clear"
          size="small"
          color="medium"
          data-testid="assistant-new"
          :aria-label="t('assistant.newConversation')"
          :title="t('assistant.newConversation')"
          @click="assistant.newConversation()"
        >
          <HubIcon
            slot="icon-only"
            name="ion:create-outline"
          />
        </ion-button>
        <ion-button
          fill="clear"
          size="small"
          color="medium"
          data-testid="assistant-close"
          :aria-label="t('assistant.close')"
          @click="close"
        >
          <HubIcon
            slot="icon-only"
            name="ion:close-outline"
          />
        </ion-button>
      </header>

      <div
        ref="thread"
        class="assistant-thread"
        data-testid="assistant-thread"
        role="log"
        aria-live="polite"
      >
        <template v-if="state.thread.bubbles.length === 0">
          <slot
            name="empty"
            :setup="state.thread.setup"
            :ask="ask"
          >
            <AssistantEmpty @ask="ask" />
          </slot>
        </template>
        <AssistantMessage
          v-for="bubble in state.thread.bubbles"
          :key="bubble.id"
          :bubble="bubble"
          :screen-exists="screenExists"
          :name-of="nameOf"
          :app-name-of="appNameOf"
          :can-upgrade="canUpgrade"
          :plan-url="planUrl"
          :can-speak="voice !== null"
          :can-report="canReport"
          :speaking="speaking === bubble.id"
          @go="go"
          @retry="assistant.retry()"
          @new-conversation="assistant.newConversation()"
          @sign-in="signIn"
          @report="reporting = bubble"
          @listen="listen(bubble)"
        />
      </div>

      <footer class="assistant-foot">
        <p
          v-if="offline"
          class="assistant-foot-note"
          role="status"
          data-testid="assistant-offline"
        >
          <HubIcon name="ion:cloud-offline-outline" />
          <span>{{ t('assistant.offline') }}</span>
        </p>
        <div
          v-if="noPlan"
          class="assistant-foot-note assistant-foot-note--plan"
          role="status"
          data-testid="assistant-no-plan"
        >
          <span>{{ t('assistant.errors.noPlan') }}</span>
          <a
            v-if="canUpgrade && planUrl"
            class="assistant-foot-upgrade"
            :href="planUrl"
            target="_blank"
            rel="noopener"
            data-testid="assistant-no-plan-upgrade"
          >
            <HubIcon name="ion:sparkles-outline" />
            {{ t('assistant.upgrade') }}
          </a>
          <span
            v-else
            data-testid="assistant-spent-note"
          >{{ t(spentNoteKeyOf(config)) }}</span>
        </div>
        <p
          v-else-if="note"
          class="assistant-foot-note"
          role="status"
          data-testid="assistant-usage"
        >
          {{ usageText }}
        </p>
        <AssistantComposer :offline="offline || noPlan" />
      </footer>
    </template>
  </aside>
  <AssistantConfirm
    :card="state.confirm?.card ?? null"
    :more="state.confirm?.more ?? false"
    @decide="(accepted, typed, stop) => assistant.decide(accepted, typed, stop)"
  />
  <AssistantReport
    v-if="canReport"
    :bubble="reporting"
    @close="reporting = null"
  />
</template>

<style scoped>
.assistant-veil {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgb(0 0 0 / 0.32);
}
.assistant-panel {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  width: min(420px, 100vw);
  padding-top: var(--ion-safe-area-top, 0px);
  border-left: 1px solid var(--ion-border-color, #e3e5e8);
  background: var(--ion-card-background, var(--ion-background-color, #fff));
  color: var(--ion-text-color, #1a1c20);
  transform: translateX(100%);
  visibility: hidden;
  transition:
    transform 0.2s ease,
    visibility 0.2s;
}
.assistant-panel[data-open='true'] {
  transform: none;
  visibility: visible;
}
@media (min-width: 768px) {
  .assistant-panel {
    width: var(--assistant-width);
  }
}
@media (prefers-reduced-motion: reduce) {
  .assistant-panel {
    transition: none;
  }
}
.assistant-head {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 52px;
  padding: 0 6px 0 16px;
  border-bottom: 1px solid var(--ion-border-color, #e3e5e8);
}
.assistant-title {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.assistant-title-icon {
  flex: none;
  color: var(--ion-color-primary);
}
.assistant-thread {
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.assistant-foot {
  flex: none;
}
.assistant-foot-note {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 8px 16px 0;
  font-size: 0.85rem;
  line-height: 1.4;
  color: var(--ion-color-medium-shade, #5f6368);
}
.assistant-foot-upgrade {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ion-color-primary);
  font-weight: 600;
  text-decoration: none;
}
</style>

<style>
/* Docked from 768 px (BASE-G110): the shell's pane leaves the panel its width, so the screen beside keeps working. */
:root {
  --assistant-width: clamp(360px, 30vw, 420px);
}
html.assistant-docked ion-app > ion-split-pane {
  right: var(--assistant-width);
}
</style>
