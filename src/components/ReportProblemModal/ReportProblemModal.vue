<script setup lang="ts">
// «Report a problem» in a dialog, so the person never leaves the app; the SaaS's page `/dashboard/report-a-problem`
// has the same texts and limits. The page sends it (`send`): this knows no operation. A refusal keeps what was typed;
// a failure with no `status` is a bug, not the network (the SDK answers that with status 0), so it says the report
// did not leave and is logged. Closing the dialog without sending keeps the draft for the next opening.
import { IonButton, IonInput, IonTextarea } from '@ionic/vue';
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';
import { FormModal, type FormModalError } from '../FormModal';
import en from './locales/en.json';
import es from './locales/es.json';
import type { ReportProblemSend, ReportProblemSent } from './types';

const props = defineProps<{
  /** Sends the report; resolves with the address support answers to, rejects with the command's error. */
  send: ReportProblemSend;
}>();

const open = defineModel<boolean>('open', { default: false });

const { t } = useI18n({ useScope: 'local', messages: { en, es } });

/** The limits of erplora.com's page and of the operation behind it. */
const SUBJECT_MAX = 150;
const DESCRIPTION_MAX = 5000;

const subject = shallowRef('');
const description = shallowRef('');
const pending = shallowRef(false);
const error = shallowRef<FormModalError | null>(null);
const sent = shallowRef<ReportProblemSent | null>(null);

const ready = computed(() => !!subject.value.trim() && !!description.value.trim());

watch(open, (isOpen) => {
  if (!isOpen) return;
  error.value = null;
  sent.value = null;
});

/** An answer of the server (an `ApiError` of `@erplora/ui/sdk`, the network's too): what it says is shown. */
function isAnswer(failure: unknown): failure is FormModalError {
  if (typeof failure !== 'object' || failure === null) return false;
  const { status, message } = failure as Partial<FormModalError>;
  return typeof status === 'number' && typeof message === 'string' && message !== '';
}

async function submit(): Promise<void> {
  if (!ready.value || pending.value) return;
  pending.value = true;
  error.value = null;
  try {
    sent.value = await props.send({ subject: subject.value.trim(), description: description.value.trim() });
    subject.value = '';
    description.value = '';
  } catch (failure) {
    if (isAnswer(failure)) {
      error.value = failure;
    } else {
      console.error('ReportProblemModal: the report did not leave', failure);
      error.value = { message: t('reportProblem.failed') };
    }
  } finally {
    pending.value = false;
  }
}

function onSubject(event: CustomEvent<{ value?: string | null }>): void {
  subject.value = event.detail.value ?? '';
}

function onDescription(event: CustomEvent<{ value?: string | null }>): void {
  description.value = event.detail.value ?? '';
}
</script>

<template>
  <FormModal
    v-model:open="open"
    class="ep-report-problem"
    testid="report-problem"
    :title="t('reportProblem.title')"
    :submit-label="t('reportProblem.send')"
    :submit-disabled="!ready"
    :pending="pending"
    :error="error"
    @submit="submit"
  >
    <template #default="{ fieldErrors }">
      <div
        v-if="sent"
        class="ep-report-problem__sent"
        data-testid="report-problem-sent"
      >
        <h2 class="ep-report-problem__sent-title">
          <HubIcon
            class="ep-report-problem__sent-icon"
            name="ion:checkmark-circle-outline"
            aria-hidden="true"
          />
          {{ t('reportProblem.sentTitle') }}
        </h2>
        <p class="ep-report-problem__text">
          {{ t('reportProblem.sentBody', { email: sent.replyTo }) }}
        </p>
      </div>
      <div
        v-else
        class="ep-report-problem__fields"
      >
        <p
          class="ep-report-problem__text"
          data-testid="report-problem-intro"
        >
          {{ t('reportProblem.intro') }}
        </p>
        <ion-input
          mode="md"
          fill="outline"
          label-placement="floating"
          data-testid="report-problem-subject"
          :maxlength="SUBJECT_MAX"
          :label="t('reportProblem.subject')"
          :value="subject"
          :error-text="fieldErrors.subject"
          :class="{ 'ion-invalid': !!fieldErrors.subject, 'ion-touched': !!fieldErrors.subject }"
          @ion-input="onSubject"
        />
        <ion-textarea
          mode="md"
          fill="outline"
          label-placement="floating"
          data-testid="report-problem-description"
          :auto-grow="true"
          :rows="6"
          :maxlength="DESCRIPTION_MAX"
          :label="t('reportProblem.description')"
          :placeholder="t('reportProblem.descriptionPlaceholder')"
          :value="description"
          :error-text="fieldErrors.description"
          :class="{ 'ion-invalid': !!fieldErrors.description, 'ion-touched': !!fieldErrors.description }"
          @ion-input="onDescription"
        />
        <p
          class="ep-report-problem__hint"
          data-testid="report-problem-context"
        >
          {{ t('reportProblem.context') }}
        </p>
      </div>
    </template>
    <template
      v-if="sent"
      #footer
    >
      <ion-button
        data-testid="report-problem-done"
        @click="open = false"
      >
        {{ t('reportProblem.close') }}
      </ion-button>
    </template>
  </FormModal>
</template>

<style scoped>
.ep-report-problem__fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ep-report-problem__text,
.ep-report-problem__hint {
  margin: 0;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.ep-report-problem__text {
  font-size: 0.9rem;
  color: color-mix(in oklab, var(--ion-text-color, #1a1c20) 80%, transparent);
}
.ep-report-problem__hint {
  font-size: 0.8rem;
  color: color-mix(in oklab, var(--ion-text-color, #1a1c20) 65%, transparent);
}
.ep-report-problem__sent-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  font-size: 1.1rem;
  font-weight: 600;
}
.ep-report-problem__sent-icon {
  flex: none;
  font-size: 1.4rem;
  color: var(--ion-color-success);
}
</style>
