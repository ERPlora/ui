// Texts of the shell itself, English source + `es` (PLAN §5: UI in en + es). Until V6 exports the
// Django `djangojs` catalogues to JSON, the shell carries its own JSON by hand (PLAN §4.7) and an
// app passes its own through `createShell({ messages })`, merged over these per locale.
// vue-i18n in Composition mode (`legacy: false`); its message compiler interprets the AST, so no
// `eval` under the strict CSP.
import { createI18n, type I18n, type I18nOptions } from 'vue-i18n';

import en from './locales/en.json';
import es from './locales/es.json';

export const SHELL_LOCALES = ['en', 'es'] as const;
export type ShellLocale = (typeof SHELL_LOCALES)[number];

type Messages = Record<string, unknown>;

const SHELL_MESSAGES: Record<ShellLocale, Messages> = { en, es };

/** `es-ES` → `es`; anything unsupported → `en`. */
export function shellLocale(language: string | undefined): ShellLocale {
  const base = (language ?? '').toLowerCase().split('-')[0];
  return (SHELL_LOCALES as readonly string[]).includes(base) ? (base as ShellLocale) : 'en';
}

function merge(base: Messages, extra: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const current = out[key];
    out[key] =
      value && typeof value === 'object' && current && typeof current === 'object'
        ? merge(current as Messages, value as Messages)
        : value;
  }
  return out;
}

/**
 * A text of the shell's own catalogue, for code outside a component (no `useI18n()` there, e.g. the
 * imperative toast). Read at call time in `language`, or else in the language of the page: createShell
 * keeps `<html lang>` in step with the person's. Unsupported language → English; unknown key → the key.
 */
export function shellText(key: string, language: string = document.documentElement.lang): string {
  const find = (tree: Messages): unknown =>
    key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Messages)[part] : undefined), tree);
  const text = find(SHELL_MESSAGES[shellLocale(language)]) ?? find(SHELL_MESSAGES.en);
  return typeof text === 'string' ? text : key;
}

export interface ShellI18nOptions {
  /** Language tag of the session (`base.session.me.language`) or of `<html lang>`. */
  locale?: string;
  /** App catalogues by locale, merged over the shell's. */
  messages?: Partial<Record<ShellLocale, Messages>>;
}

/**
 * Composition-mode instance with untyped (string) keys: the catalogues are runtime JSON merged per
 * app, so a compile-time message schema would be a lie (and makes `t()` types explode).
 */
export type ShellI18n = I18n<Record<string, never>, Record<string, never>, Record<string, never>, string, false>;

export function createShellI18n(options: ShellI18nOptions = {}): ShellI18n {
  const messages = Object.fromEntries(
    SHELL_LOCALES.map((locale) => [locale, merge(SHELL_MESSAGES[locale], options.messages?.[locale] ?? {})]),
  ) as I18nOptions['messages'];
  return createI18n({
    legacy: false,
    locale: shellLocale(options.locale),
    fallbackLocale: 'en',
    messages,
  }) as unknown as ShellI18n;
}
