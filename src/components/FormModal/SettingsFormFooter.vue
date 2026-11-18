<script setup lang="ts">
// The end of a settings page's form, painted from what `useSettingsForm` gives: the refusal's red notice while
// `showsError`, the green «saved» notice while `saved`, then «Save», off with nothing to send or while saving.
// The notices are children of the page's form, so it spaces them as it spaces its fields, and «Save» keeps its own
// width at the end of its row instead of stretching across a wide page. Every text is the page's.
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
  <div
    v-if="!readonly"
    class="ep-settings-form-footer__actions"
  >
    <ion-button
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
  </div>
</template>

<style scoped>
/* «Save» at the end of the form, at its own width (FormModal's footer). */
.ep-settings-form-footer__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
