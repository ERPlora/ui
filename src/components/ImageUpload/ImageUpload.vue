<script setup lang="ts">
// ImageUpload — one image of a form (a website's logo, its cover), the way Shopify's and WordPress's
// image settings ask for it: the current image as a thumbnail, «Choose image» / «Replace image» and
// «Remove».
//   <ImageUpload v-model="site.logo" :label="t('website.logo')" :upload="uploadImage" />
// Contract:
//   - `v-model` is the image `{ id, url }` or `null`. The page owns the transfer: `upload(file)`
//     sends it and answers the stored image, which becomes the new value.
//   - The file is checked here first: its type against `accept` (the picker filters too, but a
//     mobile picker or «All files» can hand over anything) and its size against `maxBytes`; a wrong
//     one paints an inline error and `upload` is not called.
//   - While `upload` runs: a spinner, «Uploading…», the buttons wait (nothing starts twice). A
//     rejection paints its message (the SDK's errors already speak the person's language), or a
//     generic one, and keeps the value.
//   - An image whose URL cannot be shown leaves the placeholder and says so.
import { IonButton, IonItem, IonLabel, IonNote, IonSpinner, IonThumbnail } from '@ionic/vue';
import { computed, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';
import { useComponentLocale } from '../locale';
import { acceptedTypeNames, acceptsFile, formatFileSize, formatTypeList } from './files';
import en from './locales/en.json';
import es from './locales/es.json';
import type { ImageUploadValue, ImageUploader } from './types';

const props = withDefaults(
  defineProps<{
    /** The image (`v-model`), or `null`. */
    modelValue: ImageUploadValue | null;
    /** The field's label, and the thumbnail's text alternative. */
    label: string;
    /** The file types that go (`<input type="file" accept>` syntax). */
    accept?: string;
    /** The largest file that goes, in bytes. */
    maxBytes?: number;
    /** Sends the file and answers the stored image. */
    upload: ImageUploader;
    disabled?: boolean;
    /** Prefix of the `data-testid` hooks (`<testid>` on the root, `-image`, `-empty`, `-label`,
     *  `-status`, `-rules`, `-choose`, `-remove`, `-loading`, `-error`, `-file`). */
    testid?: string;
  }>(),
  {
    accept: 'image/jpeg,image/png,image/webp',
    maxBytes: 5 * 1024 * 1024,
    disabled: false,
    testid: undefined,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: ImageUploadValue | null] }>();

const { t } = useI18n({ useScope: 'local', messages: { en, es } });
const locale = useComponentLocale();

const tid = (part: string): string | undefined => (props.testid?.trim() ? `${props.testid.trim()}-${part}` : undefined);

const picker = shallowRef<HTMLInputElement | null>(null);
const busy = ref(false);
const error = ref('');
/** The current URL could not be loaded. */
const broken = ref(false);

watch(
  () => props.modelValue?.url,
  () => {
    broken.value = false;
  },
);

const shown = computed(() => (props.modelValue && !broken.value ? props.modelValue : null));
const locked = computed(() => busy.value || props.disabled);

const typeList = computed(() => {
  const names = acceptedTypeNames(props.accept);
  return names.length ? formatTypeList(names, locale.value) : '';
});
const sizeText = computed(() => formatFileSize(props.maxBytes, locale.value));
const rules = computed(() =>
  typeList.value ? t('imageUpload.rules', { types: typeList.value, size: sizeText.value }) : t('imageUpload.rulesAny', { size: sizeText.value }),
);
const status = computed(() => {
  if (busy.value) return t('imageUpload.uploading');
  if (props.modelValue && broken.value) return t('imageUpload.broken');
  if (!props.modelValue) return t('imageUpload.empty');
  return '';
});

function choose(): void {
  if (locked.value) return;
  picker.value?.click();
}

function remove(): void {
  if (locked.value) return;
  error.value = '';
  emit('update:modelValue', null);
}

/** The message of a rejected upload: its own when it has one. */
function failure(reason: unknown): string {
  return reason instanceof Error && reason.message.trim() ? reason.message : t('imageUpload.uploadFailed');
}

async function onFile(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  // Ready for the next choice, the same file included.
  input.value = '';
  if (!file || locked.value) return;
  error.value = '';
  if (!acceptsFile(file, props.accept)) {
    error.value = typeList.value ? t('imageUpload.wrongType', { types: typeList.value }) : t('imageUpload.wrongTypeAny');
    return;
  }
  if (file.size > props.maxBytes) {
    error.value = t('imageUpload.tooLarge', { size: sizeText.value });
    return;
  }
  busy.value = true;
  try {
    const image = await props.upload(file);
    emit('update:modelValue', image);
  } catch (reason) {
    error.value = failure(reason);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div
    class="image-upload"
    :data-testid="testid"
  >
    <ion-item
      class="image-upload__item"
      lines="none"
    >
      <ion-thumbnail
        slot="start"
        class="image-upload__thumb"
      >
        <img
          v-if="shown"
          class="image-upload__image"
          :src="shown.url"
          :alt="label"
          :data-testid="tid('image')"
          @error="broken = true"
        >
        <div
          v-else
          class="image-upload__placeholder"
          :data-testid="tid('empty')"
        >
          <HubIcon name="ion:image-outline" />
        </div>
      </ion-thumbnail>
      <div class="image-upload__body">
        <ion-label class="image-upload__text">
          <h3 :data-testid="tid('label')">
            {{ label }}
          </h3>
          <!-- Always there (a live region that comes and goes is not announced); empty, it folds. -->
          <p
            role="status"
            :class="{ 'image-upload__status--empty': !status }"
            :data-testid="tid('status')"
          >
            {{ status }}
          </p>
          <p :data-testid="tid('rules')">
            {{ rules }}
          </p>
        </ion-label>
        <div class="image-upload__actions">
          <ion-button
            size="small"
            fill="outline"
            :disabled="locked"
            :data-testid="tid('choose')"
            @click="choose"
          >
            <HubIcon
              slot="start"
              name="ion:cloud-upload-outline"
            />
            {{ modelValue ? t('imageUpload.replace') : t('imageUpload.choose') }}
          </ion-button>
          <ion-button
            v-if="modelValue"
            size="small"
            fill="clear"
            color="danger"
            :disabled="locked"
            :data-testid="tid('remove')"
            @click="remove"
          >
            <HubIcon
              slot="start"
              name="ion:trash-outline"
            />
            {{ t('imageUpload.remove') }}
          </ion-button>
          <ion-spinner
            v-if="busy"
            name="crescent"
            aria-hidden="true"
            :data-testid="tid('loading')"
          />
        </div>
        <ion-note
          v-if="error"
          class="image-upload__error"
          color="danger"
          role="alert"
          :data-testid="tid('error')"
        >
          {{ error }}
        </ion-note>
      </div>
    </ion-item>
    <input
      ref="picker"
      type="file"
      hidden
      tabindex="-1"
      :accept="accept"
      :disabled="disabled"
      :data-testid="tid('file')"
      @change="onFile"
    >
  </div>
</template>

<style scoped>
.image-upload__item {
  --inner-padding-end: 0;
  align-items: flex-start;
}
.image-upload__thumb {
  --size: 64px;
  --border-radius: var(--ep-radius-sm, 6px);
  margin-block: 0.75rem;
  background: var(--ep-surface-muted, var(--ion-color-step-50, #f2f2f2));
  border-radius: var(--ep-radius-sm, 6px);
  overflow: hidden;
}
/* A logo is shown whole, not cropped. */
.image-upload__image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.image-upload__placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: var(--ep-text-muted, var(--ion-color-medium));
  font-size: 1.75rem;
}
.image-upload__body {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding-block: 0.75rem;
}
.image-upload__text {
  margin: 0;
  white-space: normal;
}
.image-upload__status--empty {
  height: 0;
  margin: 0;
  overflow: hidden;
}
/* The buttons wrap under each other on a narrow phone. */
.image-upload__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.5rem;
}
.image-upload__actions ion-button {
  margin: 0;
}
.image-upload__actions ion-spinner {
  width: 20px;
  height: 20px;
}
.image-upload__error {
  display: block;
  font-size: 0.875rem;
}
</style>
