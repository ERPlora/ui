// The mails a Django app writes with its file backend (`django.core.mail.backends.filebased.EmailBackend`),
// read back as a person reads their inbox. The SaaS writes every mail of development to
// `saas-next/.mail/` (its panel e2e to a folder of its own), and every sign-in with a password there
// waits for the six-digit code it mailed: an e2e of the SaaS or of the Hub reads it here. Plain Node
// (`node:fs`), no browser and no Playwright: import it from `@erplora/ui/testing/mail` in an e2e (the
// `@erplora/ui/testing` entry also carries the icons Vite bakes, which plain Node cannot load).
//
// What Django 6.1 writes: one file per connection, named by an id (not by time), each message closed by a
// line of 79 `-`; a body raw UTF-8 (8bit), 7bit, quoted-printable, base64 or multipart (its text part is
// read). «Since» is the file's write time: the newest matching mail written from `since` on wins, so a code
// mailed earlier to the same address (a run before, a test before) is never read.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The code of the sign-in mail and of the address verification: six digits alone on their line. */
export const MAIL_CODE = /^[ \t]*(\d{6})[ \t]*$/m;
/** The SPA's page a password reset mail links (`/password/reset/key/<key>`), absolute. */
export const PASSWORD_RESET_LINK = /https?:\/\/\S+\/password\/reset\/key\/\S+/;

/** Linux stamps a file with the clock's last tick (a few ms behind `Date.now()`): that much is forgiven. */
const CLOCK_SLACK_MS = 50;
const CLOSE = /\r?\n-{79}\r?\n/;

export interface Mail {
  /** The addresses of `To:`, in lower case. */
  to: string[];
  subject: string;
  /** The decoded text (the text part of a multipart mail). */
  body: string;
  /** When its file was last written (ms since the epoch): when it was sent. */
  writtenAt: number;
}

export interface MailQuery {
  /** The backend's folder (`EMAIL_FILE_PATH`). */
  dir: string;
  /** The address the mail went to, whatever its case. */
  to: string;
  /** `Date.now()` taken before the action that mails it. */
  since: number;
  /** How long to wait for it, in ms (15 s). */
  timeout?: number;
  /** How often to look again, in ms (100). */
  interval?: number;
}

/** Every finished mail of `dir`, oldest first; none while the folder does not exist yet. */
export function readMails(dir: string): Mail[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return []; // The backend makes the folder with its first mail.
  }
  const files = names
    .map((name) => join(dir, name))
    .flatMap((path) => {
      const stat = statSync(path, { throwIfNoEntry: false });
      return stat?.isFile() ? [{ path, writtenAt: stat.mtimeMs }] : [];
    })
    .sort((a, b) => a.writtenAt - b.writtenAt || a.path.localeCompare(b.path));
  return files.flatMap(({ path, writtenAt }) =>
    // What follows the last close is empty, or a message still being written.
    readFileSync(path, 'utf8')
      .split(CLOSE)
      .slice(0, -1)
      .map((raw) => ({ ...parseMessage(raw), writtenAt })),
  );
}

/** The value of `match` (its first group, else the whole match) in the newest mail of the query. */
function newest(query: MailQuery, match: RegExp): string | undefined {
  const to = query.to.toLowerCase();
  const from = query.since - CLOCK_SLACK_MS;
  const found = readMails(query.dir)
    .filter((mail) => mail.writtenAt >= from && mail.to.includes(to))
    .map((mail) => mail.body.match(match))
    .filter((hit): hit is RegExpMatchArray => hit !== null)
    .at(-1);
  return found ? (found[1] ?? found[0]) : undefined;
}

/**
 * Waits for the newest mail to `to` written from `since` on whose text matches `match`, and answers its
 * first group (else the whole match). Rejects after `timeout`, saying where it looked.
 */
export async function waitForMail(query: MailQuery & { match: RegExp }): Promise<string> {
  const deadline = Date.now() + (query.timeout ?? 15_000);
  for (;;) {
    const found = newest(query, query.match);
    if (found !== undefined) return found;
    if (Date.now() >= deadline) {
      throw new Error(
        `no mail to ${query.to} matching ${query.match} in ${query.dir} since ${new Date(query.since).toISOString()}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, query.interval ?? 100));
  }
}

/** The six-digit code mailed to `to` from `since` on: the sign-in's or the address verification's. */
export function readMailCode(query: MailQuery): Promise<string> {
  return waitForMail({ ...query, match: MAIL_CODE });
}

/** The password reset link mailed to `to` from `since` on, as the person clicks it. */
export function readPasswordResetLink(query: MailQuery): Promise<string> {
  return waitForMail({ ...query, match: PASSWORD_RESET_LINK });
}

// ── Parsing one message (what Python's `email` writes) ───────────────────────────────────────────

type Headers = Map<string, string>;

function splitHead(raw: string): { headers: Headers; body: string } {
  const at = raw.search(/\r?\n\r?\n/);
  const head = (at === -1 ? raw : raw.slice(0, at)).replace(/\r?\n[ \t]+/g, ' ');
  const headers: Headers = new Map();
  for (const line of head.split(/\r?\n/)) {
    const colon = line.indexOf(':');
    if (colon > 0) headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim());
  }
  return { headers, body: at === -1 ? '' : raw.slice(at).replace(/^\r?\n\r?\n/, '') };
}

function parseMessage(raw: string): Omit<Mail, 'writtenAt'> {
  const { headers, body } = splitHead(raw);
  return {
    to: (headers.get('to') ?? '').match(/[^\s<>,"]+@[^\s<>,"]+/g)?.map((address) => address.toLowerCase()) ?? [],
    subject: decodeWords(headers.get('subject') ?? ''),
    body: textOf(headers, body),
  };
}

/** The text of a part: decoded, or the first text/plain part of a multipart one. */
function textOf(headers: Headers, body: string): string {
  const type = headers.get('content-type') ?? 'text/plain';
  const boundary = /boundary="?([^";]+)"?/i.exec(type)?.[1];
  if (type.toLowerCase().startsWith('multipart/') && boundary) {
    const parts = body.split(`--${boundary}`).slice(1, -1).map((part) => splitHead(part.replace(/^\r?\n/, '')));
    const plain = parts.find((part) => (part.headers.get('content-type') ?? 'text/plain').toLowerCase().startsWith('text/plain'));
    return plain ? textOf(plain.headers, plain.body.replace(/\r?\n$/, '')) : '';
  }
  return decodeBody(body, (headers.get('content-transfer-encoding') ?? '7bit').toLowerCase());
}

function decodeBody(text: string, encoding: string): string {
  if (encoding === 'base64') return Buffer.from(text.replace(/\s+/g, ''), 'base64').toString('utf8');
  if (encoding === 'quoted-printable') return quotedPrintable(text.replace(/=\r?\n/g, ''));
  return text; // 7bit or 8bit: the file is UTF-8 already.
}

function quotedPrintable(text: string): string {
  const bytes: number[] = [];
  for (let at = 0; at < text.length; at += 1) {
    const hex = text.slice(at + 1, at + 3);
    if (text[at] === '=' && /^[0-9A-F]{2}$/i.test(hex)) {
      bytes.push(parseInt(hex, 16));
      at += 2;
    } else {
      bytes.push(...Buffer.from(text[at], 'utf8'));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

/** RFC 2047 encoded words of a header (`=?utf-8?q?C=C3=B3digo?=`, `=?utf-8?b?…?=`). */
function decodeWords(value: string): string {
  return value
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_, _charset: string, kind: string, data: string) =>
      kind.toLowerCase() === 'b'
        ? Buffer.from(data, 'base64').toString('utf8')
        : quotedPrintable(data.replace(/_/g, ' ')),
    );
}
