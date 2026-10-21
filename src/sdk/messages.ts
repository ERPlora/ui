// The sentences the SDK writes itself, for a failure the server did not word (hub#2281): an answer that is
// not the API's envelope (a proxy's HTML page, a 502, an empty body), a request that never got an answer,
// a signed-out session, a programming error in the browser. The `code` and `status` of the `ApiError` say
// which one it was; its `message` is what a person reads, so it says what happened and what to do, in the
// person's language, never an English internal text. English source + `es` (PLAN §5), from this folder's
// catalogue in `language`, or else in the language of the page (`<html lang>`, which the shell keeps in
// step with the person's), like the shell's own `shellText`. Read when the error is made.
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
