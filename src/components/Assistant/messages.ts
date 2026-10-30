// The chat's own words, English source + Spanish (PLAN §5: UI in en + es), for the host to merge into its catalogues:
//   createShell({ messages: { en: { ...assistantMessages.en, ...appEn }, es: { ...assistantMessages.es, ...appEs } } })
// All under `assistant`; the components read them from the app's i18n (`t('assistant.send')`), where the host's own
// words for its writes and screens also live (`AssistantConfig.verbKey`, `placeKey`, `screenKey`).
import en from './locales/en.json';
import es from './locales/es.json';

export const assistantMessages = { en, es } as const;
