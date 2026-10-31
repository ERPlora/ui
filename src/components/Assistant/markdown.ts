// The answer of the assistant with its format (BASE-G113): a small Markdown reader into a tree that a Vue component
// paints — never HTML (`v-html`), so nothing the model writes is ever a tag. Bold, italics, inline code, headings,
// lists, tables, quotes (`> …`, the model's warnings) and rules (`---`, the model's part breaks) are read; a link only to a path of this app
// (`[label](/settings)` or a bare `/customer/customers`): any other address stays as its label, as text (it never takes
// the person out of the app). What it does not read (fenced code, images) stays as plain text.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'code'; text: string }
  /** `label: null`: a bare path, which the panel names with the screen's own name. */
  | { kind: 'link'; path: string; label: Inline[] | null };

export type Block =
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] }
  /** Consecutive `>` lines, read again as an answer of their own (a quote may hold a list, or another quote). */
  | { kind: 'quote'; blocks: Block[] }
  /** A line of three or more `-`, `*` or `_` alone (spaces between them allowed): a line between two parts. */
  | { kind: 'rule' };

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const TABLE_ROW = /^\s*\|.*\|\s*$/;
/** A quoted line: `>` at its start (up to three spaces before), and one space after it that is not part of the text. */
const QUOTE = /^ {0,3}> ?(.*)$/;
/** A rule: up to three spaces, then three or more of the same mark among `-`, `*` and `_`, and nothing else. */
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
/** A path of this app: `/` and words, never `//` (another host) nor inside a web address. */
const HUB_PATH = /^\/(?!\/)[A-Za-z0-9_\-/]*(#[A-Za-z0-9_-]+)?$/;
const BARE_PATH = /(^|[\s(«"'])(\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*(?:#[a-z0-9_-]+)?)(?=$|[\s.,;:!?)»"'])/g;

export function isHubPath(target: string): boolean {
  return HUB_PATH.test(target);
}

function pushText(out: Inline[], value: string): void {
  if (value === '') return;
  const last = out[out.length - 1];
  if (last?.kind === 'text') last.text += value;
  else out.push({ kind: 'text', text: value });
}

/** Bare paths of plain text as links (none inside a web address: «https://x/settings» has no space before). */
function withBarePaths(value: string, out: Inline[]): void {
  let at = 0;
  for (const match of value.matchAll(BARE_PATH)) {
    const start = (match.index ?? 0) + match[1].length;
    pushText(out, value.slice(at, start));
    out.push({ kind: 'link', path: match[2], label: null });
    at = start + match[2].length;
  }
  pushText(out, value.slice(at));
}

/** The closing `marker` of an emphasis opened at `from`: not after a space, and with something inside. */
function closing(source: string, from: number, marker: string): number {
  let at = source.indexOf(marker, from);
  while (at !== -1) {
    if (at > from && !/\s/.test(source[at - 1])) return at;
    at = source.indexOf(marker, at + marker.length);
  }
  return -1;
}

export function parseInline(source: string, links = true): Inline[] {
  const out: Inline[] = [];
  let plain = '';
  const flush = () => {
    if (plain === '') return;
    if (links) withBarePaths(plain, out);
    else pushText(out, plain);
    plain = '';
  };
  let i = 0;
  while (i < source.length) {
    const char = source[i];
    if (char === '`') {
      const end = source.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ kind: 'code', text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (char === '[' && links) {
      const close = source.indexOf('](', i + 1);
      const end = close === -1 ? -1 : source.indexOf(')', close + 2);
      if (close !== -1 && end !== -1) {
        flush();
        const label = parseInline(source.slice(i + 1, close), false);
        const target = source.slice(close + 2, end).trim();
        if (isHubPath(target)) out.push({ kind: 'link', path: target, label });
        else {
          for (const piece of label) {
            if (piece.kind === 'text') pushText(out, piece.text);
            else out.push(piece);
          }
        }
        i = end + 1;
        continue;
      }
    }
    if (char === '*' || char === '_') {
      const strong = source.startsWith(char.repeat(2), i);
      const marker = strong ? char.repeat(2) : char;
      const opens = i + marker.length < source.length && !/\s/.test(source[i + marker.length]);
      const end = opens ? closing(source, i + marker.length, marker) : -1;
      // An underscore inside a word (snake_case) is no emphasis.
      const insideWord = char === '_' && i > 0 && /\w/.test(source[i - 1]);
      if (end !== -1 && !insideWord) {
        flush();
        const children = parseInline(source.slice(i + marker.length, end), links);
        out.push(strong ? { kind: 'strong', children } : { kind: 'em', children });
        i = end + marker.length;
        continue;
      }
    }
    plain += char;
    i += 1;
  }
  flush();
  return out;
}

function cells(row: string): string[] {
  return row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length) blocks.push({ kind: 'paragraph', inlines: parseInline(paragraph.join('\n')) });
    paragraph = [];
  };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      endParagraph();
      i += 1;
      continue;
    }
    if (QUOTE.test(line)) {
      endParagraph();
      const quoted: string[] = [];
      while (i < lines.length) {
        const match = QUOTE.exec(lines[i]);
        if (!match) break;
        quoted.push(match[1]);
        i += 1;
      }
      const inner = parseMarkdown(quoted.join('\n'));
      if (inner.length) blocks.push({ kind: 'quote', blocks: inner });
      continue;
    }
    // Before a list: «- - -» and «* * *» are a rule, never an item.
    if (RULE.test(line)) {
      endParagraph();
      blocks.push({ kind: 'rule' });
      i += 1;
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      endParagraph();
      blocks.push({ kind: 'heading', level: heading[1].length, inlines: parseInline(heading[2].trim()) });
      i += 1;
      continue;
    }
    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEPARATOR.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      endParagraph();
      const head = cells(line).map((cell) => parseInline(cell));
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        rows.push(cells(lines[i]).map((cell) => parseInline(cell)));
        i += 1;
      }
      blocks.push({ kind: 'table', head, rows });
      continue;
    }
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    if (bullet || numbered) {
      endParagraph();
      const ordered = Boolean(numbered);
      const pattern = ordered ? NUMBERED : BULLET;
      const items: Inline[][] = [];
      while (i < lines.length) {
        const item = pattern.exec(lines[i]);
        if (!item || RULE.test(lines[i])) break;
        items.push(parseInline(item[1].trim()));
        i += 1;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    paragraph.push(line);
    i += 1;
  }
  endParagraph();
  return blocks;
}

function inlinePaths(inlines: Inline[], found: string[]): void {
  for (const inline of inlines) {
    if (inline.kind === 'link') {
      if (!found.includes(inline.path)) found.push(inline.path);
    } else if (inline.kind === 'strong' || inline.kind === 'em') {
      inlinePaths(inline.children, found);
    }
  }
}

function blockPaths(blocks: Block[], found: string[]): void {
  for (const block of blocks) {
    if (block.kind === 'paragraph' || block.kind === 'heading') inlinePaths(block.inlines, found);
    else if (block.kind === 'list') block.items.forEach((item) => inlinePaths(item, found));
    else if (block.kind === 'quote') blockPaths(block.blocks, found);
    else if (block.kind === 'table') {
      block.head.forEach((cell) => inlinePaths(cell, found));
      block.rows.forEach((row) => row.forEach((cell) => inlinePaths(cell, found)));
    }
  }
}

/** The paths of the app an answer links, once each, in the order they appear. */
export function linkPaths(blocks: Block[]): string[] {
  const found: string[] = [];
  blockPaths(blocks, found);
  return found;
}

function spokenInlines(inlines: Inline[], nameOf?: (path: string) => string | undefined): string {
  return inlines
    .map((inline) => {
      if (inline.kind === 'text' || inline.kind === 'code') return inline.text;
      if (inline.kind === 'link') return inline.label ? spokenInlines(inline.label, nameOf) : (nameOf?.(inline.path) ?? '');
      return spokenInlines(inline.children, nameOf);
    })
    .join('');
}

/** What «Read aloud» says of an answer: its words, sentence by sentence — a screen by its name (`nameOf`), never a
 *  path or a mark; a table row by row, its cells with commas. */
export function spokenText(blocks: Block[], nameOf?: (path: string) => string | undefined): string {
  const spoken = (block: Block): string[] => {
    if (block.kind === 'paragraph' || block.kind === 'heading') return [spokenInlines(block.inlines, nameOf)];
    if (block.kind === 'list') return block.items.map((item) => spokenInlines(item, nameOf));
    if (block.kind === 'quote') return block.blocks.flatMap(spoken);
    if (block.kind === 'rule') return [];
    const row = (cells: Inline[][]) => cells.map((cell) => spokenInlines(cell, nameOf).trim()).join(', ');
    return [row(block.head), ...block.rows.map(row)];
  };
  return blocks
    .flatMap(spoken)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (/[.!?…:]$/.test(line) ? line : `${line}.`))
    .join(' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
