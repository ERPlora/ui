import { describe, expect, it } from 'vitest';

import en from './locales/en.json';
import es from './locales/es.json';
import { createShellI18n, SHELL_LOCALES, shellLocale, shellText } from './i18n';

function keys(tree: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('shell catalogues', () => {
  it('carry only what the shell and its components say (topbar, tabbar, home, apps launcher, side menu and its QR, user menu, 404, not in the app, banner and toast close, the ask for the device\'s notices)', () => {
    expect(keys(en).sort()).toEqual([
      'home.empty.body',
      'home.empty.title',
      'home.state.activating',
      'home.state.off',
      'home.title',
      'inlineFeedback.dismiss',
      'installQr.alt',
      'installQr.hint',
      'installQr.title',
      'launcher.close',
      'launcher.error',
      'launcher.loading',
      'launcher.openFailed',
      'launcher.retry',
      'launcher.title',
      'notFound.action',
      'notFound.body',
      'notFound.title',
      'notInApp.action',
      'notInApp.body',
      'notInApp.title',
      'notices.primerAllow',
      'notices.primerHeader',
      'notices.primerLater',
      'notices.primerMessage',
      'sidebar.apps',
      'sidebar.billing',
      'sidebar.employees',
      'sidebar.files',
      'sidebar.settings',
      'sidebar.system',
      'tabbar.label',
      'toast.close',
      'topbar.back',
      'topbar.collapseMenu',
      'topbar.expandMenu',
      'topbar.menu',
      'topbar.moreActions',
      'userMenu.help',
      'userMenu.logout',
      'userMenu.logoutFailed',
      'userMenu.open',
      'userMenu.openFailed',
      'userMenu.theme',
      'userMenu.themeDark',
      'userMenu.themeLight',
      'userMenu.themeSystem',
    ]);
  });

  it('the page that is not in the app names no price and carries no link out (Google Play, consumption-only)', () => {
    for (const tree of [en, es]) {
      const page = (tree as { notInApp: Record<string, string> }).notInApp;
      for (const text of Object.values(page)) {
        expect(text).not.toMatch(/https?:|www\.|€|\$/);
      }
    }
  });

  it('en and es have exactly the same keys', () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });

  it('no empty string in either language', () => {
    for (const [lang, tree] of Object.entries({ en, es })) {
      for (const key of keys(tree)) {
        const value = key.split('.').reduce<unknown>((node, k) => (node as Record<string, unknown>)[k], tree);
        expect(String(value).trim(), `${lang}:${key}`).not.toBe('');
      }
    }
  });
});

describe('shellLocale', () => {
  it('maps a language tag to a supported locale, English otherwise', () => {
    expect(SHELL_LOCALES).toEqual(['en', 'es']);
    expect(shellLocale('es')).toBe('es');
    expect(shellLocale('es-ES')).toBe('es');
    expect(shellLocale('EN-gb')).toBe('en');
    expect(shellLocale('fr')).toBe('en');
    expect(shellLocale(undefined)).toBe('en');
  });
});

describe('createShellI18n', () => {
  it('translates the shell in the given language (Composition API, no legacy)', () => {
    const i18n = createShellI18n({ locale: 'es-ES' });
    expect(i18n.mode).toBe('composition');
    expect(i18n.global.locale.value).toBe('es');
    expect(i18n.global.t('notFound.action')).toBe('Ir a Inicio');
  });

  it('merges the app catalogues over the shell ones, per locale', () => {
    const i18n = createShellI18n({
      locale: 'en',
      messages: { en: { demo: { title: 'Items' } }, es: { demo: { title: 'Artículos' } } },
    });
    expect(i18n.global.t('demo.title')).toBe('Items');
    expect(i18n.global.t('topbar.back')).toBe('Back');
    i18n.global.locale.value = 'es';
    expect(i18n.global.t('demo.title')).toBe('Artículos');
    expect(i18n.global.t('topbar.back')).toBe('Atrás');
  });
});

// Outside a component (the imperative toast) there is no `useI18n()`: the shell's own text is read
// from its catalogue in the language of the page, which createShell keeps in `<html lang>`.
describe('shellText', () => {
  it('reads a shell text in the given language, or in the language of the page', () => {
    expect(shellText('toast.close', 'es-ES')).toBe('Aceptar');
    expect(shellText('toast.close', 'en')).toBe('OK');
    document.documentElement.lang = 'es';
    expect(shellText('topbar.back')).toBe('Atrás');
    document.documentElement.lang = 'en';
    expect(shellText('topbar.back')).toBe('Back');
  });

  it('falls back to English for an unsupported language, and to the key for an unknown text', () => {
    expect(shellText('toast.close', 'fr')).toBe('OK');
    expect(shellText('toast.nope', 'es')).toBe('toast.nope');
    expect(shellText('toast', 'es')).toBe('toast');
  });
});
