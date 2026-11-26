<script setup lang="ts">
// A short form in a dialog, its fields in the default slot; longer entity forms go in a page. `submit` never closes it:
// the page sets `open = false` once its command succeeds, and meanwhile passes `pending` and, on failure, the command's
// `error` (its message on top, its 422 `fields` to the slot as `fieldErrors`). Cancel, the close button, Escape, the
// backdrop and the system Back emit `cancel` once `canDismiss` agrees; closing from the page is no cancel and never asks.
import { IonButton, IonButtons, IonHeader, IonModal, IonSpinner, IonTitle, IonToolbar } from '@ionic/vue';
import { computed, nextTick, shallowRef, useId, useTemplateRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';
import { focusedElement } from '../focus';
import { InlineFeedback } from '../InlineFeedback';
import { useDismissal } from './dismissal';
import { FIELD_HOSTS, isSaid, nameOf, PAINTS_ITS_MESSAGE, shownMessageOf } from './formFields';
import en from './locales/en.json';
import es from './locales/es.json';
import { NON_FIELD_ERRORS, useRefusal } from './refusal';
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
    /** `md` 480px, `sm` 420px, `lg` 640px (desktop). */
    size?: FormModalSize;
    /** A tap on the backdrop cancels (never while pending). */
    dismissOnBackdrop?: boolean;
    /** Save is disabled (the form is not complete yet). */
    submitDisabled?: boolean;
    /** What is still missing while Save is disabled, said next to the buttons. */
    submitHint?: string;
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
    /** Asked before the person closes it (Cancel, close, Escape, backdrop, Back): `false` keeps it open. */
    canDismiss?: () => boolean | Promise<boolean>;
  }>(),
  {
    submitLabel: undefined,
    cancelLabel: undefined,
    pending: false,
    error: null,
    size: 'md',
    dismissOnBackdrop: true,
    submitDisabled: false,
    submitHint: '',
    submitColor: 'primary',
    submitIcon: undefined,
    role: 'dialog',
    phoneLayout: 'sheet',
    readonly: false,
    testid: undefined,
    canDismiss: undefined,
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
const showsHint = computed(() => props.submitDisabled && !props.readonly && !!props.submitHint.trim());
const form = useTemplateRef<HTMLFormElement>('form');
const body = useTemplateRef<HTMLElement>('body');

const submitText = computed(() => props.submitLabel ?? t('formModal.submit'));
const cancelText = computed(() => props.cancelLabel ?? t('formModal.cancel'));
const backdropDismiss = computed(() => props.dismissOnBackdrop && !props.pending);
/** What the refusal still says while the person corrects it (`useRefusal`, shared with the pages). A new
 *  refusal reads again what the form says and brings it into view. */
const refusal = useRefusal(() => props.error, {
  onRefusal: (refused) => {
    void nextTick(readWhatTheFormSays);
    if (refused) void nextTick(bringRefusalIntoView);
  },
});
const { refusedFields, fieldErrors } = refusal;
/** The refused fields nothing in the form said when the refusal painted: their reasons go on top, since a window
 *  with no marks cannot point at them. */
const unsaid = shallowRef<ReadonlySet<string>>(new Set());
/** Their reasons, once each, but those of the fields the person has changed since. */
const unsaidReasons = computed<readonly string[]>(() => [
  ...new Set(
    Object.entries(fieldErrors.value)
      .filter(([name]) => unsaid.value.has(name))
      .map(([, reason]) => reason),
  ),
]);
/** A new opening or a new try: every message is said again. */
function sayItAllAgain(): void {
  refusal.sayItAllAgain();
  void nextTick(readWhatTheFormSays);
}
/** The server's words for a refusal by fields: they say nothing but «look at the marks». */
const POINTS_AT_THE_MARKS = 'invalid_payload';
const marksNothing = computed(() => {
  const names = Object.keys(refusedFields.value);
  return names.length > 0 && names.every((name) => unsaid.value.has(name));
});
const showsNotice = computed(
  () => refusal.showsError.value && !(props.error?.code === POINTS_AT_THE_MARKS && marksNothing.value),
);
const showsBanner = computed(() => showsNotice.value || unsaidReasons.value.length > 0);

const hookPrefix = computed(() => props.testid?.trim() || undefined);
const tid = (part?: string): string | undefined =>
  hookPrefix.value ? [hookPrefix.value, part].filter(Boolean).join('-') : undefined;

/** Bumped on every opening for a fresh `ion-modal`: Ionic copies `aria-label` and `role` into the `role="dialog"` of its
 *  shadow DOM (where `aria-labelledby` cannot reach) only once, when the element loads. */
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

/** Only Save, Enter and the footer slot's `submit` call this: the `<form>`'s own submit event is just prevented, so a
 *  native button in a custom footer (type submit by default) never submits twice, nor by mistake. */
function submit(): void {
  if (props.pending || props.submitDisabled || props.readonly) return;
  sayItAllAgain();
  emit('submit');
}

const { ionCanDismiss, cancel, onEscape } = useDismissal({
  canDismiss: () => props.canDismiss,
  pending: () => props.pending,
  backdropDismiss: () => backdropDismiss.value,
  open,
  cancelled: () => emit('cancel'),
});

/** A person changed a field. Typing bubbles up as a native `input` (scoped ion-input and ion-textarea
 *  too, and a Combo's choice says it the same way); a search in a field's own popover or modal is not
 *  a change of the form. */
function onEdit(event: Event): void {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const overlay = target.closest('ion-popover, ion-modal');
  if (overlay && form.value?.contains(overlay)) return;
  refusal.changed(refusedFieldOf(target));
}

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

/** The person may have scrolled past what the refusal says (a long form on a phone, Save at its bottom),
 *  and then it looks as if nothing happened: the first marked field, else the banner, comes into view. */
function bringRefusalIntoView(): void {
  const root = body.value;
  const first = root?.querySelector(PAINTS_ITS_MESSAGE) ?? root?.querySelector('.ep-form-modal__error');
  first?.scrollIntoView({ block: 'nearest' });
}

/** Runs once the refusal has painted, so it reads what the person sees. A closed dialog reads nothing:
 *  its opening reads again (`didPresent`). */
function readWhatTheFormSays(): void {
  const root = body.value;
  const message = props.error?.message;
  unsaid.value = new Set(
    root
      ? Object.entries(refusedFields.value)
          .filter(([, reason]) => reason !== message && !isSaid(root, reason))
          .map(([name]) => name)
      : [],
  );
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

function onDidPresent(): void {
  readWhatTheFormSays();
  focusFirstField();
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
    :can-dismiss="ionCanDismiss"
    :role="role"
    :aria-label="title"
    :aria-labelledby="titleId"
    :data-size="size"
    :data-phone-layout="phoneLayout"
    :data-testid="tid()"
    @did-present="onDidPresent"
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
            <span class="ep-form-modal__title-text">{{ title }}</span>
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
        <div
          ref="body"
          class="ep-form-modal__body ion-padding"
        >
          <InlineFeedback
            v-if="showsBanner"
            class="ep-form-modal__error"
            tone="danger"
            :data-testid="tid('error')"
          >
            <template v-if="showsNotice">
              {{ error?.message }}
            </template>
            <span
              v-for="reason in unsaidReasons"
              :key="reason"
              class="ep-form-modal__reason"
            >{{ reason }}</span>
          </InlineFeedback>
          <slot
            :field-errors="fieldErrors"
            :pending="pending"
          />
        </div>
        <div class="ep-form-modal__footer ion-padding-horizontal ion-padding-bottom">
          <p
            v-if="showsHint"
            class="ep-form-modal__hint"
            role="status"
            :data-testid="tid('hint')"
          >
            {{ submitHint }}
          </p>
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
   ion-app. Every rule hangs from `ion-modal.ep-form-modal`, so nothing leaks out. */
ion-modal.ep-form-modal {
  --width: 480px;
  --max-width: calc(100vw - 32px);
  --height: auto;
  --max-height: calc(100vh - 32px);
  --border-radius: var(--ep-radius, 14px);
  --box-shadow: var(--ep-shadow-modal);
  --ep-form-modal-backdrop-opacity: var(--ion-backdrop-opacity, 0.4);
  --backdrop-opacity: var(--ep-form-modal-backdrop-opacity);
}
ion-modal.ep-form-modal[data-size='sm'] { --width: 420px; }
ion-modal.ep-form-modal[data-size='lg'] { --width: 640px; }
/* Dark: the dialog stands out from what is behind it. */
:root.ion-palette-dark ion-modal.ep-form-modal {
  --ep-form-modal-backdrop-opacity: 0.6;
  --background: var(--ion-color-step-100, #1d2025);
}
/* Over another window (a sheet, another dialog) too: Ionic drops the backdrop and the shadow of a modal opened
   over another one (`ion-modal.modal-default.show-modal ~ ion-modal.modal-default`, its core.css), made for windows of one
   size that cover each other. This card is narrower than a sheet and the phone's sheet only as tall as its fields, so what
   is behind would show around it, neither dimmed nor apart. */
ion-modal.modal-default.show-modal ~ ion-modal.ep-form-modal.modal-default {
  --backdrop-opacity: var(--ep-form-modal-backdrop-opacity);
  --box-shadow: var(--ep-shadow-modal);
}
:root.ion-palette-dark ion-modal.ep-form-modal::part(content) {
  border: 1px solid var(--ion-border-color, #26282e);
}
/* As tall as its content (Ionic's `.ion-page` would fill a fixed height), up to the window's own cap: on a low screen
   the fields scroll between the title and the buttons instead of pushing the buttons out of the window. */
ion-modal.ep-form-modal .ion-delegate-host {
  position: relative;
  display: flex;
  flex-direction: column;
  max-height: var(--max-height);
  contain: content;
}
ion-modal.ep-form-modal ion-toolbar {
  --padding-start: 16px;
  --padding-end: 8px;
}
/* Ionic's title is one line cut with «…» (`nowrap` in its shadow `.toolbar-title`): a long question takes the lines it
   needs instead, as Material's and iOS's dialogs do. */
ion-modal.ep-form-modal .ep-form-modal__title-text {
  white-space: normal;
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
  min-height: 0;
  max-height: 70vh;
  overflow-y: auto;
}
ion-modal.ep-form-modal .ep-form-modal__error {
  margin-bottom: 16px;
}
ion-modal.ep-form-modal .ep-form-modal__reason {
  display: block;
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
/* Its own line above the buttons, at the side of Save. */
ion-modal.ep-form-modal .ep-form-modal__hint {
  flex-basis: 100%;
  margin: 0;
  text-align: end;
  font-size: 0.85rem;
  color: var(--ion-color-medium-shade, var(--ion-color-medium));
}
ion-modal.ep-form-modal .ep-form-modal__cancel {
  --color: var(--ion-text-color);
}
/* What a select has chosen takes the lines it needs. On one line it sets the select's minimum width, and a form's
   one-column grid grows to it, every field with it, past the dialog. Here it holds for a select without
   `fill` too; the outlined ones, in and out of a dialog, and the room under their label are the shared theme's (polish.css). */
ion-modal.ep-form-modal ion-select::part(text) {
  white-space: normal;
}

/* Phone: a form is a sheet from the bottom as tall as its fields, up to 90vh, the fields
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
  ion-modal.ep-form-modal[data-phone-layout='sheet'] .ep-form-modal__body {
    max-height: none;
  }
  ion-modal.ep-form-modal[data-phone-layout='sheet'] .ep-form-modal__footer {
    padding-bottom: calc(var(--ion-padding, 16px) + var(--ion-safe-area-bottom, 0px));
  }
}
</style>
