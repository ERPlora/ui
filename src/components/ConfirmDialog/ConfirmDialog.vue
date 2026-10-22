<script setup lang="ts">
// ConfirmDialog — the confirmation of a destructive or consequential action (remove a member,
// transfer the ownership, delete a business; mockups `mockups/saas-panel/business.html`): our own
// `ion-modal` (a FormModal with `role="alertdialog"`), not `ion-alert`, so it looks like every other
// dialog of the panel. Title, message (or the default slot), optional consequences, an optional
// «type the name to confirm», and Cancel / the action in its tone.
//   <ConfirmDialog v-model:open="removing" :title="…" :message="…" :confirm-label="…"
//                  :pending="remove.pending.value" :error="remove.error.value" @confirm="run" />
// Like FormModal, `confirm` does not close it: the page closes it when its action is done (and
// shows `pending` and `error` meanwhile). For a plain yes/no, `useConfirm()` does all of that.
//   - `requireText`: the action stays disabled until the person types that text (spaces around and
//     case ignored, accents not); the input is focused on opening and starts empty every time.
//   - Without it, Cancel has the focus: the safe choice on a destructive dialog.
//   - A centred card at every width, also on a phone (R-29, UX audit 2; Material 3 and iOS confirm in
//     a centred dialog and keep the sheet for tasks).
import { IonInput } from '@ionic/vue';
import { computed, shallowRef, useId, watch } from 'vue';
import { Translation, useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';
import { FormModal, type FormModalError, type FormModalSize } from '../FormModal';
import en from './locales/en.json';
import es from './locales/es.json';
import type { ConfirmConsequence, ConfirmTone } from './types';

const props = withDefaults(
  defineProps<{
    /** What is being confirmed («Remove Marta Gil»). */
    title: string;
    /** What happens (or the default slot). */
    message?: string;
    /** Text of the action (default «Confirm»); say the consequence: «Remove from the business». */
    confirmLabel?: string;
    /** Text of the cancel button (default «Cancel»). */
    cancelLabel?: string;
    /** Colour of the action. */
    tone?: ConfirmTone;
    /** Icon of the action (`set:name`). */
    confirmIcon?: string;
    /** What follows from it, one line each, with an optional icon. */
    consequences?: readonly ConfirmConsequence[];
    /** Text the person must type to enable the action (the business name). */
    requireText?: string;
    /** Label of that input (default «Confirmation»). */
    requireTextLabel?: string;
    /** The action is running. */
    pending?: boolean;
    /** The action's error. */
    error?: FormModalError | null;
    /** `sm` 420px by default; `md` 480px. */
    size?: FormModalSize;
    /** Prefix of the `data-testid` hooks (FormModal's, plus `-input`). */
    testid?: string;
  }>(),
  {
    message: undefined,
    confirmLabel: undefined,
    cancelLabel: undefined,
    tone: 'danger',
    confirmIcon: undefined,
    consequences: () => [],
    requireText: undefined,
    requireTextLabel: undefined,
    pending: false,
    error: null,
    size: 'sm',
    testid: undefined,
  },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{ confirm: []; cancel: [] }>();

defineSlots<{ default?: () => unknown }>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });

const messageId = `ep-confirm-dialog-message-${useId()}`;

const typed = shallowRef('');
watch(open, (isOpen) => {
  if (isOpen) typed.value = '';
});

/** Spaces around and inside collapsed, case ignored, accents kept («Lopez» is not «López»). */
const sameText = (a: string, b: string): boolean => {
  const tidy = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ');
  return tidy(a).localeCompare(tidy(b), undefined, { sensitivity: 'accent' }) === 0;
};

const confirmable = computed(() => !props.requireText || sameText(typed.value, props.requireText));
const items = computed(() =>
  props.consequences.map((item) => (typeof item === 'string' ? { text: item, icon: undefined } : item)),
);
const inputHook = computed(() => (props.testid?.trim() ? `${props.testid.trim()}-input` : undefined));

function onTyped(event: CustomEvent<{ value?: string | null }>): void {
  typed.value = event.detail.value ?? '';
}
</script>

<template>
  <FormModal
    v-model:open="open"
    class="ep-confirm-dialog"
    role="alertdialog"
    phone-layout="card"
    :aria-describedby="messageId"
    :title="title"
    :submit-label="confirmLabel ?? t('confirmDialog.confirm')"
    :cancel-label="cancelLabel ?? t('confirmDialog.cancel')"
    :submit-color="tone"
    :submit-icon="confirmIcon"
    :submit-disabled="!confirmable"
    :pending="pending"
    :error="error"
    :size="size"
    :testid="testid"
    @submit="emit('confirm')"
    @cancel="emit('cancel')"
  >
    <div
      :id="messageId"
      class="ep-confirm-dialog__message"
    >
      <slot>
        <p
          v-if="message"
          class="ep-confirm-dialog__text"
        >
          {{ message }}
        </p>
      </slot>
    </div>
    <ul
      v-if="items.length"
      class="ep-confirm-dialog__consequences"
    >
      <li
        v-for="item in items"
        :key="item.text"
      >
        <HubIcon
          v-if="item.icon"
          class="ep-confirm-dialog__consequence-icon"
          :name="item.icon"
          aria-hidden="true"
        />
        <span>{{ item.text }}</span>
      </li>
    </ul>
    <template v-if="requireText">
      <Translation
        keypath="confirmDialog.typeToConfirm"
        tag="p"
        class="ep-confirm-dialog__prompt"
        scope="parent"
      >
        <template #text>
          <strong>{{ requireText }}</strong>
        </template>
      </Translation>
      <ion-input
        mode="md"
        fill="outline"
        label-placement="floating"
        autocomplete="off"
        autocapitalize="off"
        :spellcheck="false"
        :label="requireTextLabel ?? t('confirmDialog.typeToConfirmLabel')"
        :value="typed"
        :data-testid="inputHook"
        @ion-input="onTyped"
      />
    </template>
  </FormModal>
</template>

<style scoped>
.ep-confirm-dialog__text,
.ep-confirm-dialog__prompt {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
  color: color-mix(in oklab, var(--ion-text-color, #1a1c20) 70%, transparent);
}
.ep-confirm-dialog__consequences {
  display: grid;
  gap: 10px;
  margin: 14px 0;
  padding: 0;
  list-style: none;
  font-size: 0.9rem;
  line-height: 1.45;
}
.ep-confirm-dialog__consequences li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}
.ep-confirm-dialog__consequence-icon {
  flex: none;
  margin-top: 2px;
  font-size: 16px;
  color: color-mix(in oklab, var(--ion-text-color, #1a1c20) 60%, transparent);
}
.ep-confirm-dialog__prompt {
  margin: 14px 0 10px;
}
.ep-confirm-dialog__prompt strong {
  color: var(--ion-text-color, #1a1c20);
}
</style>
