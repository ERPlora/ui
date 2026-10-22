// The file rules of ImageUpload: the `accept` list (the syntax of `<input type="file" accept>`: MIME
// types, `type/*` families and `.ext` extensions, comma-separated), the names a person reads for it,
// and the size limit in words. The file picker filters by `accept` too, but a drop, a mobile picker
// or "All files" can still hand over anything: the component checks again with these.

/** The entries of an `accept` list, trimmed and in lower case. */
function entries(accept: string): string[] {
  return accept
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** Whether the file matches an entry of `accept`; an empty list takes any file. */
export function acceptsFile(file: { name: string; type: string }, accept: string): boolean {
  const list = entries(accept);
  if (!list.length) return true;
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return list.some((entry) => {
    if (entry.startsWith('.')) return name.endsWith(entry);
    if (entry.endsWith('/*')) return type.startsWith(entry.slice(0, -1));
    return type === entry;
  });
}

/** The names people know the usual formats by (MIME subtype or extension → name). */
const KNOWN: Readonly<Record<string, string>> = {
  jpeg: 'JPEG',
  jpg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  'svg+xml': 'SVG',
  svg: 'SVG',
  gif: 'GIF',
  avif: 'AVIF',
};

/** The formats of `accept` as a person reads them, once each; `[]` when a family (`image/*`) or
 *  nothing is listed, since then no list of names says what goes. */
export function acceptedTypeNames(accept: string): string[] {
  const list = entries(accept);
  if (!list.length || list.some((entry) => entry.endsWith('/*'))) return [];
  const names = list.map((entry) => {
    const key = entry.startsWith('.') ? entry.slice(1) : entry.slice(entry.indexOf('/') + 1);
    return KNOWN[key] ?? key.toUpperCase();
  });
  return [...new Set(names)];
}

/** «JPEG, PNG, or WebP» in the page's language. */
export function formatTypeList(names: string[], locale: string): string {
  return new Intl.ListFormat(locale, { style: 'long', type: 'disjunction' }).format(names);
}

const KIB = 1024;
const MIB = 1024 * KIB;

/** A size limit in words: megabytes from 1 MiB, kilobytes below (one decimal at most). */
export function formatFileSize(bytes: number, locale: string): string {
  const [value, unit] = bytes >= MIB ? [bytes / MIB, 'megabyte'] : [bytes / KIB, 'kilobyte'];
  return new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay: 'short', maximumFractionDigits: 1 }).format(value);
}
