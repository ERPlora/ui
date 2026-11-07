// The decimal mark a person types a number with («,» in Spanish, «.» in English): the one place a field, a keypad or
// an edited amount asks for it, instead of each app working it out from Intl on its own (hub#983).
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as components from '../index';
import { decimalMark } from './decimalMark';
import * as format from './index';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('decimalMark', () => {
  it('is the comma in Spanish and the point in English', () => {
    expect(decimalMark('es')).toBe(',');
    expect(decimalMark('es-ES')).toBe(',');
    expect(decimalMark('en')).toBe('.');
    expect(decimalMark('en-US')).toBe('.');
  });

  it('is the mark of any other language, as Intl writes it', () => {
    expect(decimalMark('de-CH')).toBe('.');
    expect(decimalMark('fr-FR')).toBe(',');
    expect(decimalMark('ar-EG')).toBe('٫');
  });

  it('is the point for a tag Intl refuses, as the till keypads and the refund already read it', () => {
    expect(decimalMark('es_ES')).toBe('.');
  });

  it('works a language out once and gives the same mark after that', () => {
    const NumberFormat = Intl.NumberFormat;
    const built = vi
      .spyOn(Intl, 'NumberFormat')
      .mockImplementation(function (...args: ConstructorParameters<typeof Intl.NumberFormat>) {
        return new NumberFormat(...args);
      } as unknown as typeof Intl.NumberFormat);
    const first = decimalMark('pt-BR');
    const second = decimalMark('pt-BR');
    expect(first).toBe(',');
    expect(second).toBe(first);
    expect(built).toHaveBeenCalledTimes(1);
  });

  it('keeps each language its own mark', () => {
    expect(decimalMark('it-IT')).toBe(',');
    expect(decimalMark('en-GB')).toBe('.');
    expect(decimalMark('it-IT')).toBe(',');
  });

  it('lets an error that is not a refused tag through', () => {
    vi.spyOn(Intl, 'NumberFormat').mockImplementation(function () {
      throw new TypeError('broken');
    } as unknown as typeof Intl.NumberFormat);
    expect(() => decimalMark('nl-NL')).toThrow(TypeError);
  });

  it('is part of the shared formatters and of `@erplora/ui/components`', () => {
    expect(format.decimalMark).toBe(decimalMark);
    expect((components as Record<string, unknown>).decimalMark).toBe(decimalMark);
  });
});
