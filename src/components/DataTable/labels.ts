// Texts of the DataTable chrome. Resolution order, per key:
//   1. the `labels` prop (one table, e.g. «Add time slot»; kept from the Lit API);
//   2. the app's vue-i18n through `t('dataTable.<key>')`, when its catalogue carries the key (an app
//      can reword a text for every table through `createShell({ messages })`);
//   3. the catalogue bundled here (`locales/{en,es}.json`), in the i18n locale, or in the language of
//      `<html lang>` when no vue-i18n is installed (what the Lit original read).
import { type App, computed, getCurrentInstance } from 'vue';
import { useI18n } from 'vue-i18n';

import { shellLocale } from '../../shell/i18n';
import en from './locales/en.json';
import es from './locales/es.json';
import type { DataTableLabelKey, DataTableLabels } from './types';

const CATALOGUES: Record<'en' | 'es', DataTableLabels> = { en: en.dataTable, es: es.dataTable };

export type LabelParams = Record<string, string | number>;

/** `{name}` tokens filled from `params`; a token without a value is left as written. */
export function fillLabel(template: string, params: LabelParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (token: string, name: string) =>
    name in params ? String(params[name]) : token,
  );
}

/** The app's global composer, or `null` when vue-i18n is not installed in this app. Same check as
 *  `useI18n` makes before throwing `NOT_INSTALLED`, so it never has to be caught. */
function optionalI18n() {
  const app = getCurrentInstance()?.appContext.app as (App & { __VUE_I18N_SYMBOL__?: unknown }) | undefined;
  return app?.__VUE_I18N_SYMBOL__ ? useI18n({ useScope: 'global' }) : null;
}

/** Call from `setup`. `text()` is reactive: it follows the overrides and the i18n locale. */
export function useDataTableLabels(overrides: () => Partial<DataTableLabels> | undefined) {
  const i18n = optionalI18n();
  const locale = computed(() =>
    shellLocale(i18n ? i18n.locale.value : typeof document === 'undefined' ? 'en' : document.documentElement.lang),
  );

  function text(key: DataTableLabelKey, params?: LabelParams): string {
    const own = overrides()?.[key];
    if (own !== undefined) return fillLabel(own, params);
    const path = `dataTable.${key}`;
    if (i18n?.te(path)) return i18n.t(path, params ?? {});
    return fillLabel(CATALOGUES[locale.value][key], params);
  }

  return { text, locale };
}
