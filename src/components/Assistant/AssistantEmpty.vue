<script setup lang="ts">
// The empty conversation (BASE-G111; the old hub's empty drawer): the sparkles, the sentence and the shortcuts, each
// asked at once (`ask`). The words are the host's — the Hub's: its setup's sentence and «How do I set up “…”?» for the
// steps left (BASE-G121), through `AssistantPanel`'s `empty` slot —; without them, the chat's own sentence.
import { useI18n } from 'vue-i18n';

import HubIcon from '../../shell/HubIcon.vue';

withDefaults(defineProps<{ text?: string; shortcuts?: readonly string[] }>(), { text: undefined, shortcuts: () => [] });
const emit = defineEmits<{ ask: [text: string] }>();

const { t } = useI18n({ useScope: 'global' });
</script>

<template>
  <div
    class="assistant-empty"
    data-testid="assistant-empty"
  >
    <HubIcon
      class="assistant-empty-icon"
      name="ion:sparkles-outline"
    />
    <p class="assistant-empty-text">
      {{ text ?? t('assistant.empty') }}
    </p>
    <div class="assistant-empty-shortcuts">
      <button
        v-for="shortcut in shortcuts"
        :key="shortcut"
        type="button"
        class="assistant-shortcut"
        data-testid="assistant-shortcut"
        @click="emit('ask', shortcut)"
      >
        {{ shortcut }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.assistant-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 4px 16px;
  text-align: center;
}
.assistant-empty-icon {
  font-size: 40px;
  color: var(--ion-color-primary);
}
.assistant-empty-text {
  margin: 0 0 8px;
  max-width: 320px;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--ion-color-medium-shade, #5f6368);
}
.assistant-empty-shortcuts {
  display: grid;
  gap: 8px;
  width: 100%;
}
.assistant-shortcut {
  width: 100%;
  min-height: 40px;
  padding: 9px 14px;
  border: 1px solid var(--ion-border-color, #e3e5e8);
  border-radius: 10px;
  background: var(--ion-card-background, var(--ion-background-color, #fff));
  color: var(--ion-text-color, #1a1c20);
  font: inherit;
  font-size: 0.9rem;
  line-height: 1.35;
  text-align: start;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.assistant-shortcut:hover,
.assistant-shortcut:focus-visible {
  border-color: var(--ion-color-primary);
  background: color-mix(in oklab, var(--ion-color-primary) 6%, transparent);
}
</style>
