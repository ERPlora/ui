// The sentences the SDK writes itself, for a failure the server did not word: an answer that is not the
// API's envelope (a proxy's HTML page, a 502, an empty body), a request that never got an answer, a
// signed-out session, a programming error in the browser. The `ApiError`'s `code` and `status` say which
// one it was; its `message` is what a person reads, so it says what happened and what to do in their
// language: `language`, or else the page's `<html lang>`, which the shell keeps in step with the person's.
import { shellLocale } from "../shell/i18n";
import en from "./locales/en.json";
import es from "./locales/es.json";

const CATALOGUES = { en: en.sdk.errors, es: es.sdk.errors } as const;

export type SdkMessage = keyof typeof en.sdk.errors;

function pageLanguage(): string {
  return typeof document === "undefined" ? "" : document.documentElement.lang;
}

export function sdkMessage(key: SdkMessage, language: string = pageLanguage()): string {
  return CATALOGUES[shellLocale(language)][key];
}
