import { shellLocale } from '../../shell/i18n';
import en from './locales/en.json';
import es from './locales/es.json';

export const ALLERGEN_CODES = [
  'gluten',
  'crustaceans',
  'egg',
  'fish',
  'peanut',
  'soy',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const;

export type AllergenCode = (typeof ALLERGEN_CODES)[number];

const CATALOGUES = { en: en.allergens, es: es.allergens } as const;

export function allergenName(code: AllergenCode, locale?: string): string {
  return CATALOGUES[shellLocale(locale)][code];
}

export function formatAllergens(codes: readonly string[], locale?: string): string {
  const selected = new Set(codes);
  return ALLERGEN_CODES.filter((code) => selected.has(code))
    .map((code) => allergenName(code, locale))
    .join(', ');
}
