// The chat's own words in English and Spanish, all under `assistant`. The components read them through the app's i18n,
// so the host merges them into its own catalogues:
//   createShell({ messages: { en: { ...assistantMessages.en, ...appEn }, es: { ...assistantMessages.es, ...appEs } } })
import en from './locales/en.json';
import es from './locales/es.json';

export const assistantMessages = { en, es } as const;
