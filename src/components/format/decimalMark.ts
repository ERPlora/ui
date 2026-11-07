// `decimalMark`: the one way a field, a keypad or an amount being edited learns the decimal mark a person types in
// their language («,» in Spanish, «.» in English), worked out once per language from Intl. A tag Intl refuses reads
// as the point, the mark a server decimal carries. What is painted goes through `formatMoney` and `formatQuantity`.

const POINT = '.';

const marks = new Map<string, string>();

export function decimalMark(locale: string): string {
  let found = marks.get(locale);
  if (found === undefined) {
    try {
      found = new Intl.NumberFormat(locale).formatToParts(1.5).find((part) => part.type === 'decimal')?.value ?? POINT;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      found = POINT;
    }
    marks.set(locale, found);
  }
  return found;
}
