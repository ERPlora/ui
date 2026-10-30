<script setup lang="ts">
// «Report a problem» under a finished answer (BASE-G123; the old hub's HUB_SHELL-F198, the stores' rule for generated
// content): what is wrong with it — wrong by default, harmful, it did not do what was asked, something else — and an
// optional comment; the answer goes with the question it answered to the host's review (`AssistantConfig.report`; the
// Hub's: erplora.com's). Sent: a thank-you and it closes; refused: the dialog stays open with its sentence, the choice
// and the comment kept. Cancel sends nothing. Only mounted for a host that takes reports (`AssistantPanel`).
import { IonRadio, IonRadioGroup, IonTextarea } from '@ionic/vue';
import { onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useLiveClient } from '../../sdk/live-client';
import { toastSuccess } from '../../shell/toast';
import { FormModal, type FormModalError } from '../FormModal';
import { assistantConfig, type AssistantReportInput } from './config';
import type { Bubble } from './history';

type Reason = AssistantReportInput['reason'];

const REASONS: Reason[] = ['incorrect', 'harmful', 'instructions', 'other'];

const props = defineProps<{ bubble: Bubble | null }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n({ useScope: 'global' });
const client = useLiveClient();
const { report } = assistantConfig();

const open = ref(false);
const shown = shallowRef<Bubble | null>(null);
const reason = ref<Reason>('incorrect');
const comment = ref('');
const pending = ref(false);
const error = ref<FormModalError | null>(null);

// Opened after mounting: Ionic presents a modal only once it is in the page.
function follow(bubble: Bubble | null): void {
  if (bubble) {
    shown.value = bubble;
    reason.value = 'incorrect';
    comment.value = '';
    error.value = null;
  }
  open.value = bubble !== null;
}

onMounted(() => follow(props.bubble));
watch(() => props.bubble, follow);

function onReason(event: CustomEvent<{ value?: unknown }>): void {
  const value = event.detail.value;
  if (REASONS.includes(value as Reason)) reason.value = value as Reason;
}

function onComment(event: CustomEvent<{ value?: string | null }>): void {
  comment.value = event.detail.value ?? '';
}

async function send(): Promise<void> {
  const bubble = shown.value;
  if (!bubble || !report || pending.value) return;
  pending.value = true;
  error.value = null;
  const input: AssistantReportInput = { message_id: bubble.id, reason: reason.value, answer: bubble.text };
  const note = comment.value.trim();
  if (note) input.comment = note;
  if (bubble.question) input.question = bubble.question;
  try {
    await report(client, input);
    open.value = false;
    void toastSuccess(t('assistant.report.sent'));
    emit('close');
  } catch {
    error.value = { message: t('assistant.report.failed') };
  } finally {
    pending.value = false;
  }
}

function cancel(): void {
  emit('close');
}
</script>

<template>
  <FormModal
    v-model:open="open"
    testid="assistant-report-dialog"
    size="sm"
    :title="t('assistant.report.title')"
    :submit-label="t('assistant.report.send')"
    :pending="pending"
    :error="error"
    @submit="send"
    @cancel="cancel"
  >
    <p class="assistant-report-intro">
      {{ t('assistant.report.intro') }}
    </p>
    <ion-radio-group
      :value="reason"
      data-testid="assistant-report-reason"
      :aria-label="t('assistant.report.reason')"
      @ion-change="onReason"
    >
      <p class="assistant-report-label">
        {{ t('assistant.report.reason') }}
      </p>
      <ion-radio
        v-for="option in REASONS"
        :key="option"
        :value="option"
        justify="start"
        label-placement="end"
        class="assistant-report-option"
        :data-testid="`assistant-report-reason-${option}`"
      >
        {{ t(`assistant.report.reasons.${option}`) }}
      </ion-radio>
    </ion-radio-group>
    <ion-textarea
      mode="md"
      fill="outline"
      label-placement="floating"
      class="assistant-report-comment"
      data-testid="assistant-report-comment"
      :label="t('assistant.report.comment')"
      :value="comment"
      :auto-grow="true"
      :rows="3"
      :maxlength="2000"
      @ion-input="onComment"
    />
  </FormModal>
</template>

<style scoped>
.assistant-report-intro,
.assistant-report-label {
  margin: 0 0 10px;
  line-height: 1.5;
}
.assistant-report-label {
  font-weight: 600;
}
.assistant-report-option {
  display: flex;
  width: 100%;
  min-height: 40px;
}
.assistant-report-comment {
  margin-top: 12px;
}
</style>
