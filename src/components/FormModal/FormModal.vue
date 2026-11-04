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
//   - A refusal with `fields` says on top only «check the highlighted details»: that notice goes away
//     as soon as something is changed and comes back if the next try is refused. Each field's message
//     goes away as soon as that field is changed (typed or chosen; never on focus or blur), and the
//     next refusal says them all again (ui#89; Odoo, WooCommerce, Shopify). FormModal tells the field
//     by its `name` when it is a key of `fields` (as a Django form names its errors), else by the
//     message it shows (`error-text`) when no other refused field has those words. A refusal without
//     `fields`, or of the whole form (`__all__`), stays until the next try: nothing else says it.
//   - Cancel, the close button, Escape and the backdrop (`dismissOnBackdrop`) emit `cancel` and set
//     `open` to false; closing from the page is not a cancel.
//   - Enter in a single-line field submits; Escape cancels (not while pending). Only Save, Enter and
//     the footer slot's `submit` submit: the `<form>`'s own submit event is just prevented, so a
//     native button in a custom footer (type submit by default) never submits twice, nor by mistake.
//   - Focus: on opening, a `[data-autofocus]` field, else the first field, else Cancel (read only:
//     Close) on its native button, so Enter presses it, unless the person is already in the form; on
//     closing, back to what had it before (the button that opened it, its native button for an
//     `ion-button`).
//   - `readonly`: a window that only shows data (ui#62; Odoo, Shopify, Business Central) — the footer
//     is a single «Close» that closes it as the header's does (`cancel`); nothing submits.
//   - Named by its title: Ionic copies `aria-label` and `role` into its own `role="dialog"` (in its
//     shadow DOM, where `aria-labelledby` cannot reach) once, when the element loads, so each
//     opening renders a fresh `ion-modal` and the name is always the current title.
//   - Desktop: a centred card (480px, `sm` 420px) as tall as its content. Below 640px (R-29, UX
//     audit 2): a sheet from the bottom with the sheet's rounded top, as tall as its content up to
//     90vh, the fields scrolling between the title and the buttons; with `phoneLayout: 'card'` (a
//     confirmation, ConfirmDialog) the centred card at every width.
import { IonButton, IonButtons, IonHeader, IonModal, IonSpinner, IonTitle, IonToolbar } from '@ionic/vue';
import { computed, shallowRef, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';
import { focusedElement } from '../focus';
import { InlineFeedback } from '../InlineFeedback';
import en from './locales/en.json';
import es from './locales/es.json';
import type {
  FormModalError,
  FormModalFieldsSlotProps,
  FormModalFooterSlotProps,
  FormModalPhoneLayout,
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
    /** Below 640px: a bottom `sheet` (forms) or the centred `card` (confirmations). */
    phoneLayout?: FormModalPhoneLayout;
    /** It only shows data: the footer is a single «Close» (no Save, no Cancel) and nothing submits. */
    readonly?: boolean;
    /** Prefix of the `data-testid` hooks (`<testid>`, `-submit`, `-cancel`, `-close`, `-done`, `-error`). */
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
    phoneLayout: 'sheet',
    readonly: false,
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
const refusedFields = computed<Readonly<Record<string, string>>>(() => props.error?.fields ?? {});
/** Something was changed since the refusal: its notice has done its job. */
const edited = shallowRef(false);
/** The refused fields the person has changed since: their message has done its job too. */
const corrected = shallowRef<ReadonlySet<string>>(new Set());
/** What the fields still say: the refusal's messages but the corrected ones. */
const fieldErrors = computed<Readonly<Record<string, string>>>(() =>
  Object.fromEntries(Object.entries(refusedFields.value).filter(([name]) => !corrected.value.has(name))),
);
/** A new refusal, a new opening or a new try: every message is said again. */
function sayItAllAgain(): void {
  edited.value = false;
  corrected.value = new Set();
}
// By value, not by object: a parent that re-renders the same refusal does not bring anything back.
// Named, because an `ApiError`'s `message` is not enumerable and `JSON.stringify` would leave it out.
watch(
  () => {
    const error = props.error;
    return error ? JSON.stringify([error.status, error.code, error.message, error.fields]) : '';
  },
  sayItAllAgain,
);
/** The notice only repeats what the highlighted fields say; the reason of the whole form (`__all__`,
 *  as in Django forms) is said nowhere else, and is no field: changing one never takes it away. */
const NON_FIELD_ERRORS = '__all__';
const onlyPointsAtFields = computed(() => {
  const names = Object.keys(refusedFields.value);
  return names.length > 0 && !names.includes(NON_FIELD_ERRORS);
});
const showsError = computed(() => !!props.error && !(edited.value && onlyPointsAtFields.value));

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
    sayItAllAgain();
    returnFocusTo = focusedElement();
    presentation.value += 1;
  },
  { flush: 'sync', immediate: true },
);

function submit(): void {
  if (props.pending || props.submitDisabled || props.readonly) return;
  sayItAllAgain();
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

/** A person changed a field. Typing bubbles up as a native `input` (scoped ion-input and ion-textarea
 *  too, and a Combo's choice says it the same way); a search in a field's own popover or modal is not
 *  a change of the form. */
function onEdit(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const overlay = target.closest('ion-popover, ion-modal');
  if (overlay && form.value?.contains(overlay)) return;
  edited.value = true;
  const name = refusedFieldOf(target);
  if (name) corrected.value = new Set([...corrected.value, name]);
}

/** The fields a page puts in the slot. Ionic's own say who they are on their host. */
const FIELD_HOSTS = 'ion-input, ion-textarea, ion-select, ion-checkbox, ion-toggle, ion-radio-group, ion-range';
type FieldHost = Element & { name?: unknown; errorText?: unknown };

/** The refused field the person changed, or nothing when it cannot tell: by its own `name` when it
 *  is a key of the refusal, else by the message it shows when no other refused field has those
 *  words (two fields saying «Required.» are not told apart by guess). The keystroke lands on
 *  Ionic's native input, inside its field; a Combo says its choice from its wrapper, around one. */
function refusedFieldOf(target: Element): string | undefined {
  const pending = Object.keys(fieldErrors.value).filter((name) => name !== NON_FIELD_ERRORS);
  if (pending.length === 0) return undefined;
  const inside = target.querySelectorAll(FIELD_HOSTS);
  const candidates = [target.closest(FIELD_HOSTS), target, inside.length === 1 ? inside[0] : null];
  for (const el of candidates) {
    if (!el) continue;
    const name = nameOf(el);
    if (name && pending.includes(name)) return name;
    const shown = shownMessageOf(el);
    if (shown) {
      const saying = pending.filter((key) => fieldErrors.value[key] === shown);
      return saying.length === 1 ? saying[0] : undefined;
    }
  }
  return undefined;
}

/** A native field's `name`, or an Ionic one's (it hands it to its native input). */
function nameOf(el: Element): string | null {
  const name = (el as FieldHost).name;
  return typeof name === 'string' && name ? name : null;
}

/** What an Ionic field shows under it: Ionic Vue sets `error-text` as the element's property. */
function shownMessageOf(el: Element): string | null {
  const shown = (el as FieldHost).errorText;
  return typeof shown === 'string' && shown ? shown : null;
}

/** ion-select, ion-toggle, ion-checkbox and the like only speak by `ionChange`. A text field's says on
 *  blur what `input` already told: after Enter sent the form, leaving the field corrects nothing. */
const TEXT_FIELDS = 'ion-input, ion-textarea, ion-searchbar';
function onIonChange(event: Event): void {
  if (event.target instanceof Element && event.target.matches(TEXT_FIELDS)) return;
  onEdit(event);
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

/** Ionic fields focus their native control through `setFocus()`. An `ion-button` has none, and its
 *  host cannot take the focus (no tabindex, a shadow root that does not delegate it): its native
 *  button, the `native` shadow part, takes it, and Enter presses it (ui#73). Anything else, `focus()`. */
function focusElement(el: HTMLElement): void {
  const ionic = el as HTMLElement & { setFocus?: () => Promise<void> };
  if (typeof ionic.setFocus === 'function') void ionic.setFocus();
  else (el.shadowRoot?.querySelector<HTMLElement>('[part~="native"]') ?? el).focus();
}

function focusFirstField(): void {
  const root = form.value;
  if (!root) return;
  // `didPresent` lands when the opening animation ends, and the fields already take the focus during
  // it: whoever went to one is typing there, and moving them would drop their text in the first field.
  if (root.contains(document.activeElement)) return;
  const marked = root.querySelector<HTMLElement>('[data-autofocus]');
  const field = marked ?? [...root.querySelectorAll<HTMLElement>(FIELDS)].find((el) => !isDisabled(el));
  const target = field ?? root.querySelector<HTMLElement>('.ep-form-modal__cancel, .ep-form-modal__done');
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
    :data-phone-layout="phoneLayout"
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
        @input="onEdit"
        @ionChange="onIonChange"
      >
        <div class="ep-form-modal__body ion-padding">
          <InlineFeedback
            v-if="showsError"
            class="ep-form-modal__error"
            tone="danger"
            :data-testid="tid('error')"
          >
            {{ error?.message }}
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
              v-if="readonly"
              class="ep-form-modal__done"
              :disabled="pending"
              :data-testid="tid('done')"
              @click="cancel"
            >
              {{ t('formModal.close') }}
            </ion-button>
            <template v-else>
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
            </template>
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
/* What a select has chosen takes the lines it needs. On one line it sets the select's minimum width, and a form's
   one-column grid grows to it, every field with it, past the dialog (hub#760, hub#784). */
ion-modal.ep-form-modal ion-select::part(text) {
  white-space: normal;
}
/* An outlined select floats its label over its top edge, 8px into the box, and centres the text in 56px: from three lines
   the text fills the box and the label lies on it (ui#93). Every line count gets the room two lines have, (56 - 1 - 2 × 18) / 2:
   one or two lines still fit in 56px, and with more the box grows. */
ion-modal.ep-form-modal ion-select.select-fill-outline::part(text) {
  padding-block: 9.5px;
}

/* Phone (R-29): a form is a sheet from the bottom as tall as its fields, up to 90vh, the fields
   scrolling between the title and the buttons. A confirmation (`card`) keeps the centred card. */
@media (max-width: 639.98px) {
  ion-modal.ep-form-modal[data-phone-layout='sheet'] {
    --width: 100%;
    --max-width: 100%;
    --height: auto;
    --max-height: 90vh;
    --border-radius: var(--ep-radius-sheet-top, 18px 18px 0 0);
    align-items: flex-end;
  }
  /* Capped like the sheet, so what does not fit scrolls instead of being cut off. */
  ion-modal.ep-form-modal[data-phone-layout='sheet'] .ion-delegate-host {
    display: flex;
    flex-direction: column;
    max-height: 90vh;
  }
  ion-modal.ep-form-modal[data-phone-layout='sheet'] .ep-form-modal__body {
    min-height: 0;
    max-height: none;
  }
  ion-modal.ep-form-modal[data-phone-layout='sheet'] .ep-form-modal__footer {
    padding-bottom: calc(var(--ion-padding, 16px) + var(--ion-safe-area-bottom, 0px));
  }
}
</style>
