<script setup lang="ts">
// FormModal — the dialog of a short form on a row or a list (invite, change role, new API key,
// billing details; mockups `mockups/saas-panel/`, README §3b): an `ion-modal` with the title and a
// close button, the fields (default slot) and a footer Cancel / Save. Longer entity forms go in a
// page (PLAN-SAAS §3.6).
//   <FormModal v-model:open="inviting" :title="t('invite.title')" :pending="invite.pending.value"
//              :error="invite.error.value" @submit="send">
//     <template #default="{ fieldErrors }">
//       <ion-input v-model="email" mode="md" fill="outline" :error-text="fieldErrors.email" … />
//     </template>
//   </FormModal>
// Contract:
//   - `submit` never closes it: the page closes it (`open = false`) when its command succeeds, and
//     meanwhile passes `pending` (Save disabled with a spinner; nothing closes it) and, on failure,
//     the command's `error` (its message on top, its 422 `fields` to the slot as `fieldErrors`).
//   - Cancel, the close button, Escape and the backdrop (`dismissOnBackdrop`) emit `cancel` and set
//     `open` to false; closing from the page is not a cancel.
//   - Enter in a single-line field submits; Escape cancels (not while pending). Only Save, Enter and
//     the footer slot's `submit` submit: the `<form>`'s own submit event is just prevented, so a
//     native button in a custom footer (type submit by default) never submits twice, nor by mistake.
//   - Focus: on opening, a `[data-autofocus]` field, else the first field, else Cancel; on closing,
//     back to what had it before (the button that opened it).
//   - Named by its title: Ionic copies `aria-label` and `role` into its own `role="dialog"` (in its
//     shadow DOM, where `aria-labelledby` cannot reach) once, when the element loads, so each
//     opening renders a fresh `ion-modal` and the name is always the current title.
//   - Desktop: a centred card (480px, `sm` 420px) as tall as its content. Below 640px: a sheet
//     from the bottom, full height, with the sheet's rounded top.
import { IonButton, IonButtons, IonHeader, IonModal, IonSpinner, IonTitle, IonToolbar } from '@ionic/vue';
import { computed, shallowRef, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';
import { InlineFeedback } from '../InlineFeedback';
import en from './locales/en.json';
import es from './locales/es.json';
import type {
  FormModalError,
  FormModalFieldsSlotProps,
  FormModalFooterSlotProps,
  FormModalRole,
  FormModalSize,
} from './types';

const props = withDefaults(
  defineProps<{
    /** Title of the dialog, and its accessible name. */
    title: string;
    /** Text of the submit button (default «Save»). */
    submitLabel?: string;
    /** Text of the cancel button (default «Cancel»). */
    cancelLabel?: string;
    /** A submit is running: Save shows a spinner and nothing submits or closes the dialog. */
    pending?: boolean;
    /** The command's error: its message on top, its `fields` to the slot. */
    error?: FormModalError | null;
    /** `md` 480px, `sm` 420px (desktop). */
    size?: FormModalSize;
    /** A tap on the backdrop cancels (never while pending). */
    dismissOnBackdrop?: boolean;
    /** Save is disabled (the form is not complete yet). */
    submitDisabled?: boolean;
    /** Ionic colour of Save (`danger` for a destructive form). */
    submitColor?: string;
    /** Icon of Save (`set:name`, registered in `shell/icons.ts`). */
    submitIcon?: string;
    /** `alertdialog` for consequential confirmations. */
    role?: FormModalRole;
    /** Prefix of the `data-testid` hooks (`<testid>`, `-submit`, `-cancel`, `-close`, `-error`). */
    testid?: string;
  }>(),
  {
    submitLabel: undefined,
    cancelLabel: undefined,
    pending: false,
    error: null,
    size: 'md',
    dismissOnBackdrop: true,
    submitDisabled: false,
    submitColor: 'primary',
    submitIcon: undefined,
    role: 'dialog',
    testid: undefined,
  },
);

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits<{ submit: []; cancel: [] }>();

defineSlots<{
  default?: (props: FormModalFieldsSlotProps) => unknown;
  footer?: (props: FormModalFooterSlotProps) => unknown;
}>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });

const titleId = `ep-form-modal-title-${useId()}`;
const form = useTemplateRef<HTMLFormElement>('form');

const submitText = computed(() => props.submitLabel ?? t('formModal.submit'));
const cancelText = computed(() => props.cancelLabel ?? t('formModal.cancel'));
const backdropDismiss = computed(() => props.dismissOnBackdrop && !props.pending);
const fieldErrors = computed<Readonly<Record<string, string>>>(() => ({ ...(props.error?.fields ?? {}) }));

const hookPrefix = computed(() => props.testid?.trim() || undefined);
const tid = (part?: string): string | undefined =>
  hookPrefix.value ? [hookPrefix.value, part].filter(Boolean).join('-') : undefined;

/** Bumped on every opening: a fresh `ion-modal`, so Ionic reads the current title and role. */
const presentation = shallowRef(0);
/** What had the focus when the dialog opened: it gets it back on closing. */
let returnFocusTo: HTMLElement | null = null;

watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    const active = document.activeElement;
    returnFocusTo = active instanceof HTMLElement && active !== document.body ? active : null;
    presentation.value += 1;
  },
  { flush: 'sync', immediate: true },
);

function submit(): void {
  if (props.pending || props.submitDisabled) return;
  emit('submit');
}

function cancel(): void {
  if (props.pending) return;
  emit('cancel');
  open.value = false;
}

/** Escape: with backdrop dismissal Ionic dismisses on its own (→ `onDidDismiss`); without it, here. */
function onEscape(): void {
  if (props.pending || backdropDismiss.value) return;
  cancel();
}

/** Enter in a single-line field submits; a textarea, a button or an IME composition keep theirs, and
 *  so does a field that handles its own Enter: already handled (a Combo picking an option), read
 *  only (a chooser that opens on it), or inside a popover or a modal of a field (its search box).
 *  Scoped ion-input/ion-searchbar let that keydown bubble up to the form. */
const NOT_SUBMITTING_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);
function onEnter(event: KeyboardEvent): void {
  if (event.isComposing || event.defaultPrevented) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement) || NOT_SUBMITTING_INPUTS.has(target.type) || target.readOnly) return;
  const overlay = target.closest('ion-popover, ion-modal');
  if (overlay && form.value?.contains(overlay)) return;
  event.preventDefault();
  submit();
}

/** The dialog closed: Ionic's own dismissal (backdrop, Escape) is a cancel; then the focus goes back. */
function onDidDismiss(): void {
  if (open.value) {
    emit('cancel');
    open.value = false;
  }
  const target = returnFocusTo;
  returnFocusTo = null;
  if (target?.isConnected) target.focus();
}

const FIELDS =
  'ion-input, ion-textarea, ion-select, ion-checkbox, ion-toggle, ion-radio-group, ion-searchbar, input:not([type="hidden"]), textarea';

const isDisabled = (el: Element): boolean =>
  el.hasAttribute('disabled') || (el as HTMLElement & { disabled?: boolean }).disabled === true;

/** Ionic fields focus their native control through `setFocus()`; anything else, `focus()`. */
function focusElement(el: HTMLElement): void {
  const ionic = el as HTMLElement & { setFocus?: () => Promise<void> };
  if (typeof ionic.setFocus === 'function') void ionic.setFocus();
  else el.focus();
}

function focusFirstField(): void {
  const root = form.value;
  if (!root) return;
  const marked = root.querySelector<HTMLElement>('[data-autofocus]');
  const field = marked ?? [...root.querySelectorAll<HTMLElement>(FIELDS)].find((el) => !isDisabled(el));
  const target = field ?? root.querySelector<HTMLElement>('.ep-form-modal__cancel');
  if (target) focusElement(target);
}
</script>

<template>
  <ion-modal
    :key="presentation"
    class="ep-form-modal"
    :is-open="open"
    :backdrop-dismiss="backdropDismiss"
    :role="role"
    :aria-label="title"
    :aria-labelledby="titleId"
    :data-size="size"
    :data-testid="tid()"
    @did-present="focusFirstField"
    @did-dismiss="onDidDismiss"
  >
    <div
      class="ep-form-modal__content"
      @keydown.esc="onEscape"
    >
      <ion-header class="ion-no-border">
        <ion-toolbar>
          <ion-title
            :id="titleId"
            class="ep-form-modal__title"
          >
            {{ title }}
          </ion-title>
          <ion-buttons slot="end">
            <ion-button
              class="ep-form-modal__close"
              :aria-label="t('formModal.close')"
              :disabled="pending"
              :data-testid="tid('close')"
              @click="cancel"
            >
              <HubIcon
                slot="icon-only"
                name="ion:close-outline"
              />
            </ion-button>
          </ion-buttons>
        </ion-toolbar>
      </ion-header>
      <form
        ref="form"
        class="ep-form-modal__form"
        novalidate
        :aria-busy="pending ? 'true' : undefined"
        @submit.prevent
        @keydown.enter="onEnter"
      >
        <div class="ep-form-modal__body ion-padding">
          <InlineFeedback
            v-if="error"
            class="ep-form-modal__error"
            tone="danger"
            :data-testid="tid('error')"
          >
            {{ error.message }}
          </InlineFeedback>
          <slot
            :field-errors="fieldErrors"
            :pending="pending"
          />
        </div>
        <div class="ep-form-modal__footer ion-padding-horizontal ion-padding-bottom">
          <slot
            name="footer"
            :submit="submit"
            :cancel="cancel"
            :pending="pending"
          >
            <ion-button
              class="ep-form-modal__cancel"
              fill="clear"
              :disabled="pending"
              :data-testid="tid('cancel')"
              @click="cancel"
            >
              {{ cancelText }}
            </ion-button>
            <ion-button
              class="ep-form-modal__submit"
              :color="submitColor"
              :disabled="pending || submitDisabled"
              :data-testid="tid('submit')"
              @click="submit"
            >
              <ion-spinner
                v-if="pending"
                slot="start"
                name="crescent"
                aria-hidden="true"
              />
              <HubIcon
                v-else-if="submitIcon"
                slot="start"
                :name="submitIcon"
              />
              {{ submitText }}
            </ion-button>
          </slot>
        </div>
      </form>
    </div>
  </ion-modal>
</template>

<style>
/* Not scoped: Ionic renders the modal's own wrapper (`.ion-delegate-host`) and moves the modal to
   ion-app. Every rule hangs from `ion-modal.ep-form-modal`, so nothing leaks out. The look is the
   mockups' `erplora-dialog` (old `ionic-theme.css` + `mock.css`), with our tokens. */
ion-modal.ep-form-modal {
  --width: 480px;
  --max-width: calc(100vw - 32px);
  --height: auto;
  --max-height: calc(100vh - 32px);
  --border-radius: var(--ep-radius, 14px);
  --box-shadow: var(--ep-shadow-modal);
}
ion-modal.ep-form-modal[data-size='sm'] {
  --width: 420px;
}
/* Dark: the dialog stands out from what is behind it (UX audit U-90). */
:root.ion-palette-dark ion-modal.ep-form-modal {
  --backdrop-opacity: 0.6;
  --background: var(--ion-color-step-100, #1d2025);
}
:root.ion-palette-dark ion-modal.ep-form-modal::part(content) {
  border: 1px solid var(--ion-border-color, #26282e);
}
/* As tall as its content (Ionic's `.ion-page` would fill a fixed height). */
ion-modal.ep-form-modal .ion-delegate-host {
  position: relative;
  display: block;
  contain: content;
}
ion-modal.ep-form-modal ion-toolbar {
  --padding-start: 16px;
  --padding-end: 8px;
}
ion-modal.ep-form-modal .ep-form-modal__content,
ion-modal.ep-form-modal .ep-form-modal__form {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
ion-modal.ep-form-modal .ep-form-modal__form {
  margin: 0;
}
ion-modal.ep-form-modal .ep-form-modal__body {
  max-height: 70vh;
  overflow-y: auto;
}
ion-modal.ep-form-modal .ep-form-modal__error {
  margin-bottom: 16px;
}
ion-modal.ep-form-modal .ep-form-modal__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
ion-modal.ep-form-modal .ep-form-modal__footer ion-button {
  margin: 0;
}
/* Cancel in the text colour, both themes (the mockups' neutral button). */
ion-modal.ep-form-modal .ep-form-modal__cancel {
  --color: var(--ion-text-color);
}

/* Phone: a sheet from the bottom, full height, the fields scrolling between title and buttons. */
@media (max-width: 639.98px) {
  ion-modal.ep-form-modal {
    --width: 100%;
    --max-width: 100%;
    --height: calc(100% - var(--ion-safe-area-top, 0px) - 12px);
    --max-height: none;
    --border-radius: var(--ep-radius-sheet-top, 18px 18px 0 0);
    align-items: flex-end;
  }
  ion-modal.ep-form-modal .ion-delegate-host {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  ion-modal.ep-form-modal .ep-form-modal__content,
  ion-modal.ep-form-modal .ep-form-modal__form,
  ion-modal.ep-form-modal .ep-form-modal__body {
    flex: 1 1 auto;
  }
  ion-modal.ep-form-modal .ep-form-modal__body {
    max-height: none;
  }
  ion-modal.ep-form-modal .ep-form-modal__footer {
    padding-bottom: calc(var(--ion-padding, 16px) + var(--ion-safe-area-bottom, 0px));
  }
}
</style>
