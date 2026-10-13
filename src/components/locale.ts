// The language a component of `@erplora/ui/components` paints its texts and numbers in when the
// page does not pass one, in this order: the app's vue-i18n locale (the person's, which
// `createShell` installs; reactive), the language of the page (`<html lang>`, which the shell keeps
// in step), the browser's, English. The tag comes back as written (`es-ES`), for `Intl`; a
// component's own catalogue picks its language with `shellLocale(tag)`.
import { type App, computed, type ComputedRef, getCurrentInstance } from 'vue';
import { useI18n } from 'vue-i18n';

/** The app's global composer, or `null` when vue-i18n is not installed (the same check `useI18n`
 *  makes before throwing `NOT_INSTALLED`, so it never has to be caught). */
function optionalI18n() {
  const app = getCurrentInstance()?.appContext.app as (App & { __VUE_I18N_SYMBOL__?: unknown }) | undefined;
  return app?.__VUE_I18N_SYMBOL__ ? useI18n({ useScope: 'global' }) : null;
}

/** Call from `setup`. `explicit` is the component's own `locale` prop, which wins when given. */
export function useComponentLocale(explicit?: () => string | undefined): ComputedRef<string> {
  const i18n = optionalI18n();
  return computed(
    () =>
      explicit?.() ||
      i18n?.locale.value ||
      (typeof document === 'undefined' ? '' : document.documentElement.lang) ||
      (typeof navigator === 'undefined' ? '' : navigator.language) ||
      'en',
  );
}
