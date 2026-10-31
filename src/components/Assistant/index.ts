// The assistant's chat, the same for the Hub and the SaaS (each with its own tools): the panel, its topbar button, the
// conversation's state, dictation and the card's words. The host configures it once when it boots
// (`configureAssistant`) and merges its words (`assistantMessages`) into its catalogues.
export { default as AssistantButton } from './AssistantButton.vue';
export { default as AssistantEmpty } from './AssistantEmpty.vue';
export { default as AssistantPanel } from './AssistantPanel.vue';
export { cardLine, fieldLabelKey, fieldLines, fieldText, typedMatches } from './card';
export type { AssistantCard, AssistantField, CardFormat } from './card';
export { assistantConfig, configureAssistant, spentNoteKeyOf, verbKeyOf } from './config';
export type { AssistantApproval, AssistantClip, AssistantConfig, AssistantReportInput, AssistantUsage } from './config';
export { MAX_AUDIO_BYTES, useDictation } from './dictation';
export type { Dictation, DictationOptions, DictationProblem } from './dictation';
export type { Bubble, ChatMessage } from './history';
export { ASSISTANT_ICONS } from './icons';
export { browserVoice } from './input';
export type { VoiceEnv } from './input';
export { assistantMessages } from './messages';
export { createAssistant, forgetAssistant, installAssistant, useAssistant } from './state';
export type { Assistant, AssistantDeps, AssistantState } from './state';
export type { Decision, PendingCall, TurnBody, TurnFrame, TurnOptions } from './stream';
