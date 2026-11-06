<script setup lang="ts">
// SettingsFormFooter — the end of a settings page's form, the one every «Settings» tab of the Hub had
// copied (hub#897; APPOINTMENT-F19, RESERVATION-F03, ONLINE_BOOKING-F07, STAFF-F22, TABLE-F08,
// KITCHEN-F26, ATTENDANCE-F04, SERVICE-F11), painted from what `useSettingsForm` gives:
//   const settings = useSettingsForm(data, useCommand('app.settings.update'), { toForm });
//   const { form, fieldErrors, set } = settings;
//   <form @submit.prevent="settings.save()">
//     …the fields…
//     <SettingsFormFooter :settings="settings" testid="app-settings" :save-label="t('app.settings.save')"
//                         :saved-label="t('app.settings.saved')" :error-heading="t('app.settings.saveError')" />
//   </form>
// Contract:
//   - The refusal's red notice (its message, under `errorHeading` if any) while `showsError` says it has
//     something to say; the green «saved» notice while `saved`; then «Save» (submit), off with nothing to
//     send or while saving, and a tap on it saves (`settings.save()`).
//   - Every text is the page's (`saveLabel`, `savedLabel`, `errorHeading`): the piece says nothing of its own.
//   - The three are the page form's own children, in that order (no wrapper): the form lays them out as it
//     did when each page wrote them by hand.
//   - Hooks: `<testid>-save-error`, `<testid>-saved` and `<testid>-save`.
//   - Variants: `spinner` (Save spins while saving), `saveIcon` (its icon, the spinner replacing it while
//     saving), `allowUnchanged` (Save stays on with nothing to send: it sends nothing and says «saved»)
//     and `readonly` (no Save: whoever may not change the settings).
import { IonButton, IonSpinner } from '@ionic/vue';
import { computed, type Ref } from 'vue';

import HubIcon from '../../shell/HubIcon.vue';
import { InlineFeedback } from '../InlineFeedback';
import type { FormModalError } from './types';

/** What the footer reads from `useSettingsForm` (its return value fits as it is). */
export interface SettingsFormFooterState {
  /** The last save went through and nothing was changed since. */
  readonly saved: Readonly<Ref<boolean>>;
  /** There is something to send. */
  readonly dirty: Readonly<Ref<boolean>>;
  /** A save on its way. */
  readonly pending: Readonly<Ref<boolean>>;
  /** Whether the refusal's notice still has something to say. */
  readonly showsError: Readonly<Ref<boolean>>;
  /** Why the last save failed. */
  readonly error: Readonly<Ref<FormModalError | null | undefined>>;
  /** Judges, sends the changes and paints the answer. */
  save(): Promise<void>;
}

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  /** What `useSettingsForm` returned. */
  settings: SettingsFormFooterState;
  /** Prefix of the `data-testid` hooks (`<testid>-save-error`, `-saved`, `-save`). */
  testid: string;
  /** Text of «Save». */
  saveLabel: string;
  /** What the green notice says after a save. */
  savedLabel: string;
  /** Heading of the red notice, above the refusal's message (none by default). */
  errorHeading?: string;
  /** «Save» spins while saving. */
  spinner?: boolean;
  /** Icon at the start of «Save» (the spinner takes its place while saving). */
  saveIcon?: string;
  /** «Save» stays on with nothing to send (it sends nothing and says «saved»). */
  allowUnchanged?: boolean;
  /** Whoever may not change the settings: no «Save». */
  readonly?: boolean;
}>();

const saved = computed(() => props.settings.saved.value);
const pending = computed(() => props.settings.pending.value);
const showsError = computed(() => props.settings.showsError.value);
const message = computed(() => props.settings.error.value?.message);
const saveOff = computed(() => pending.value || (!props.allowUnchanged && !props.settings.dirty.value));

function save(): void {
  void props.settings.save();
}
</script>

<template>
  <InlineFeedback
    v-if="showsError"
    tone="danger"
    :data-testid="`${testid}-save-error`"
    :heading="errorHeading"
  >
    {{ message }}
  </InlineFeedback>
  <InlineFeedback
    v-if="saved"
    tone="success"
    :data-testid="`${testid}-saved`"
  >
    {{ savedLabel }}
  </InlineFeedback>
  <ion-button
    v-if="!readonly"
    type="submit"
    :data-testid="`${testid}-save`"
    :disabled="saveOff"
    @click="save"
  >
    <ion-spinner
      v-if="spinner && pending"
      slot="start"
      name="crescent"
      aria-hidden="true"
    />
    <HubIcon
      v-else-if="saveIcon"
      slot="start"
      :name="saveIcon"
    />
    {{ saveLabel }}
  </ion-button>
</template>
