import { describe, expect, it } from 'vitest';

import { ALLERGEN_CODES, allergenName, formatAllergens } from './allergens';

const ENGLISH_NAMES = [
  'Gluten',
  'Crustaceans',
  'Egg',
  'Fish',
  'Peanut',
  'Soy',
  'Milk',
  'Tree nuts',
  'Celery',
  'Mustard',
  'Sesame',
  'Sulphites',
  'Lupin',
  'Molluscs',
];

describe('allergens', () => {
  it('keeps the fourteen codes in the regulatory order', () => {
    expect(ALLERGEN_CODES).toEqual([
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
    ]);
    expect(ALLERGEN_CODES.map((code) => allergenName(code, 'en'))).toEqual(ENGLISH_NAMES);
  });

  it('formats selected names once each and in list order, whatever order they arrive in', () => {
    expect(formatAllergens(['milk', 'gluten', 'milk'], 'en')).toBe('Gluten, Milk');
    expect(formatAllergens([...ALLERGEN_CODES].reverse(), 'es')).toBe(
      'Gluten, Crustáceos, Huevo, Pescado, Cacahuete, Soja, Leche, Frutos de cáscara, Apio, Mostaza, Sésamo, Sulfitos, Altramuces, Moluscos',
    );
  });

  it('returns an empty text for no declared allergens and ignores unknown codes', () => {
    expect(formatAllergens([], 'en')).toBe('');
    expect(formatAllergens(['unknown', 'fish'], 'en-GB')).toBe('Fish');
  });
});
