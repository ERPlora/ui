// @vitest-environment node
// In plain Node, as an e2e runs it: no DOM, and `node:fs` is the one it reads with. The samples below are what
// Django 6.1's file backend writes: one file per connection named by an id, each message closed by a line of 79 `-`,
// its body raw UTF-8 (8bit), quoted-printable, base64 or multipart.
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MAIL_CODE,
  PASSWORD_RESET_LINK,
  readMailCode,
  readMails,
  readMailsSince,
  readPasswordResetLink,
  waitForMail,
} from './mail';

// The file system as it is, watched: which calls a wait makes, and on which files.
vi.mock('node:fs', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return {
    ...fs,
    readdirSync: vi.fn(fs.readdirSync),
    readFileSync: vi.fn(fs.readFileSync),
    statSync: vi.fn(fs.statSync),
  };
});
vi.mock('node:fs/promises', async (importOriginal) => {
  const fs = await importOriginal<typeof import('node:fs/promises')>();
  return { ...fs, readFile: vi.fn(fs.readFile) };
});

const CLOSE = `\n${'-'.repeat(79)}\n`;

let dir: string;
let file = 0;

const pending: ReturnType<typeof setTimeout>[] = [];

/** Runs `step` in `ms`, unless its test is over by then: a mail late for one test never lands in the next one's folder. */
function later(ms: number, step: () => void): void {
  pending.push(setTimeout(step, ms));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'erplora-mail-'));
  vi.clearAllMocks();
});

afterEach(() => {
  pending.splice(0).forEach(clearTimeout);
  rmSync(dir, { recursive: true, force: true });
});

interface Sample {
  to?: string;
  subject?: string;
  body?: string;
  headers?: string;
  /** When the file was written, in ms since the epoch. */
  at?: number;
}

function message({ to = 'ana@example.com', subject = 'Sign-In Code', body = 'Your sign-in code is listed below.\n\n123456\n', headers }: Sample): string {
  return [
    headers ?? 'Content-Type: text/plain; charset="utf-8"\nContent-Transfer-Encoding: 7bit\nMIME-Version: 1.0',
    `Subject: ${subject}`,
    'From: noreply@erplora.com',
    `To: ${to}`,
    'Date: Thu, 15 Oct 2026 07:54:25 +0000',
    'Message-ID: <179205086578.64017.1860121084732289587@example.arpa>',
    '',
    body,
  ].join('\n');
}

/** Writes a file as Django's backend does (`<date>-<id>.log`), closed, its mtime at `at`. */
function write(messages: Sample[], at = Date.now()): string {
  file += 1;
  const path = join(dir, `20261015-095425-44${String(9_000_000 - file).padStart(8, '0')}.log`);
  writeFileSync(path, messages.map((sample) => `${message(sample)}${CLOSE}`).join(''));
  utimesSync(path, at / 1000, at / 1000);
  return path;
}

/** How many times `path` was read, in either way. */
function readsOf(path: string): number {
  return [...vi.mocked(readFileSync).mock.calls, ...vi.mocked(readFile).mock.calls].filter(([read]) => read === path)
    .length;
}

/** How many synchronous calls were made on the folder and its files: none stops Node. */
function syncCalls(): number[] {
  return [readdirSync, statSync, readFileSync].map((sync) => vi.mocked(sync).mock.calls.length);
}

describe('readMails: every finished mail of the folder, oldest first', () => {
  it('reads the recipients, the subject and the body of a plain 7bit mail', () => {
    write([{ to: 'Ana@Example.com', subject: 'Sign-In Code', body: 'Hello\n\n123456\n' }]);
    const [mail] = readMails(dir);
    expect(mail.to).toEqual(['ana@example.com']);
    expect(mail.subject).toBe('Sign-In Code');
    expect(mail.body).toBe('Hello\n\n123456\n');
  });

  it('decodes a raw UTF-8 body (8bit) and an encoded subject', () => {
    write([
      {
        subject: '=?utf-8?q?C=C3=B3digo_de_acceso?=',
        headers: 'Content-Type: text/plain; charset="utf-8"\nContent-Transfer-Encoding: 8bit\nMIME-Version: 1.0',
        body: 'Hola, tu código está aquí:\n\n654321\n',
      },
    ]);
    const [mail] = readMails(dir);
    expect(mail.subject).toBe('Código de acceso');
    expect(mail.body).toContain('tu código está aquí');
  });

  it('decodes a quoted-printable and a base64 body', () => {
    write([
      {
        headers: 'Content-Type: text/plain; charset="utf-8"\nContent-Transfer-Encoding: quoted-printable\nMIME-Version: 1.0',
        body: 'Tu c=C3=B3digo es=\n:\n\n111111\n',
      },
      {
        subject: '=?utf-8?b?Q8OzZGlnbw==?=',
        headers: 'Content-Type: text/plain; charset="utf-8"\nContent-Transfer-Encoding: base64\nMIME-Version: 1.0',
        body: Buffer.from('Código\n\n222222\n').toString('base64'),
      },
    ]);
    const [qp, b64] = readMails(dir);
    expect(qp.body).toBe('Tu código es:\n\n111111\n');
    expect([b64.subject, b64.body]).toEqual(['Código', 'Código\n\n222222\n']);
  });

  it('reads the text part of a multipart mail, never its HTML', () => {
    const boundary = '===============8720534361312902955==';
    write([
      {
        headers: `MIME-Version: 1.0\nContent-Type: multipart/alternative;\n boundary="${boundary}"`,
        body: [
          `--${boundary}`,
          'Content-Type: text/plain; charset="utf-8"',
          'Content-Transfer-Encoding: 7bit',
          '',
          'Plain part 111222',
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset="utf-8"',
          'Content-Transfer-Encoding: 7bit',
          '',
          '<p>999999</p>',
          '',
          `--${boundary}--`,
          '',
        ].join('\n'),
      },
    ]);
    const [mail] = readMails(dir);
    expect(mail.body).toBe('Plain part 111222\n');
  });

  it('lists every recipient of a To with names and several addresses, in lower case', () => {
    write([{ to: 'Ana García <Ana@Example.com>, bo@example.com' }]);
    expect(readMails(dir)[0].to).toEqual(['ana@example.com', 'bo@example.com']);
  });

  it('orders the mails by when their file was written, not by its name', () => {
    const now = Date.now();
    write([{ body: 'second\n' }], now);
    write([{ body: 'first\n' }], now - 5_000);
    expect(readMails(dir).map((mail) => mail.body)).toEqual(['first\n', 'second\n']);
  });

  it('skips a message still being written (not closed yet)', () => {
    writeFileSync(join(dir, 'open.log'), `${message({})}${CLOSE}${message({ body: 'half' })}`);
    expect(readMails(dir)).toHaveLength(1);
  });

  it('is empty while nothing was mailed (the backend makes the folder with its first mail)', () => {
    expect(readMails(join(dir, 'missing'))).toEqual([]);
  });

  it('ignores what is not a file of mails (a folder inside)', () => {
    mkdirSync(join(dir, 'nested'));
    write([{}]);
    expect(readMails(dir)).toHaveLength(1);
  });
});

describe('MAIL_CODE: the six digits alone on their line of the code mails', () => {
  it('matches the code of the sign-in mail and of the address verification', () => {
    expect('Your sign-in code is listed below.\n\n  123456  \n\nThanks'.match(MAIL_CODE)?.[1]).toBe('123456');
  });

  it('never a longer number nor digits within a sentence', () => {
    expect('order 1234567\n'.match(MAIL_CODE)).toBeNull();
    expect('your code 123456 is here\n'.match(MAIL_CODE)).toBeNull();
  });
});

describe('readMailCode: the code of the newest mail to the address since the action', () => {
  it('answers the six digits mailed to the address', async () => {
    const since = Date.now();
    write([{ body: 'Your sign-in code is listed below.\n\n482913\n' }], since + 10);
    await expect(readMailCode({ dir, to: 'ana@example.com', since })).resolves.toBe('482913');
  });

  it('matches the address whatever its case', async () => {
    const since = Date.now();
    write([{ to: 'Ana@Example.com', body: '\n555555\n' }], since + 10);
    await expect(readMailCode({ dir, to: 'ANA@example.COM', since })).resolves.toBe('555555');
  });

  it('takes the newest when several arrived (a stale code from earlier the same second is never read)', async () => {
    const since = Date.now();
    write([{ body: '\n111111\n' }], since + 5);
    write([{ body: '\n222222\n' }], since + 20);
    await expect(readMailCode({ dir, to: 'ana@example.com', since })).resolves.toBe('222222');
  });

  it('never reads a mail written before the action, nor one to somebody else', async () => {
    const since = Date.now();
    write([{ body: '\n111111\n' }], since - 2_000);
    write([{ to: 'bo@example.com', body: '\n333333\n' }], since + 10);
    await expect(readMailCode({ dir, to: 'ana@example.com', since, timeout: 300 })).rejects.toThrow(
      /no mail to ana@example\.com/,
    );
  });

  it('waits for a mail that is still on its way', async () => {
    const since = Date.now();
    later(150, () => write([{ body: '\n777777\n' }]));
    await expect(readMailCode({ dir, to: 'ana@example.com', since, timeout: 3_000, interval: 25 })).resolves.toBe('777777');
  });

  it('says where it looked when no mail comes in time', async () => {
    await expect(readMailCode({ dir, to: 'ana@example.com', since: Date.now(), timeout: 100 })).rejects.toThrow(dir);
  });
});

describe('readPasswordResetLink and waitForMail', () => {
  it('answers the reset link of the SPA mailed to the address', async () => {
    const since = Date.now();
    write([{ body: 'Click the link below.\n\nhttp://localhost:8012/password/reset/key/3-abc-def\n' }], since + 10);
    await expect(readPasswordResetLink({ dir, to: 'ana@example.com', since })).resolves.toBe(
      'http://localhost:8012/password/reset/key/3-abc-def',
    );
    expect(PASSWORD_RESET_LINK.test('https://erplora.com/password/reset/key/1-x')).toBe(true);
  });

  it('answers the first group of any pattern, else the whole match', async () => {
    const since = Date.now();
    write([{ body: 'Invitation: https://erplora.com/invitation?id=42\n' }], since + 10);
    await expect(waitForMail({ dir, to: 'ana@example.com', since, match: /invitation\?id=(\d+)/ })).resolves.toBe('42');
    await expect(waitForMail({ dir, to: 'ana@example.com', since, match: /https:\/\/\S+/ })).resolves.toBe(
      'https://erplora.com/invitation?id=42',
    );
  });
});

describe('waitForMail: reads only what is new since its last look, without stopping Node', () => {
  it('finds the mail written after the action among many older ones that match too', async () => {
    const since = Date.now();
    for (let at = 1; at <= 20; at += 1) write([{ body: `\n${100_000 + at}\n` }], since - at * 1_000);
    later(60, () => write([{ body: '\n482913\n' }], Date.now() + 10));
    await expect(readMailCode({ dir, to: 'ana@example.com', since, timeout: 3_000, interval: 10 })).resolves.toBe(
      '482913',
    );
  });

  it('never reads a file written before the action, though its mail is to the address and matches', async () => {
    const since = Date.now();
    const old = write([{ body: '\n111111\n' }], since - 2_000);
    write([{ body: '\n222222\n' }], since + 10);
    await expect(readMailCode({ dir, to: 'ana@example.com', since })).resolves.toBe('222222');
    expect(readsOf(old)).toBe(0);
  });

  it('reads a file once while it does not change, however many times it looks', async () => {
    const since = Date.now();
    const other = write([{ to: 'bo@example.com', body: '\n333333\n' }], since + 10);
    later(150, () => write([{ body: '\n444444\n' }], Date.now() + 10));
    await expect(readMailCode({ dir, to: 'ana@example.com', since, timeout: 3_000, interval: 10 })).resolves.toBe(
      '444444',
    );
    expect(readsOf(other)).toBe(1);
  });

  it('reads again a file that grew since its last look: a mail half written counts once it is closed', async () => {
    const since = Date.now();
    const at = (since + 10) / 1000;
    const path = join(dir, 'open.log');
    const whole = `${message({ body: 'Your sign-in code is listed below.\n\n123456\n' })}${CLOSE}`;
    const cut = whole.lastIndexOf('123456') + 2;
    writeFileSync(path, whole.slice(0, cut));
    utimesSync(path, at, at);
    later(150, () => {
      appendFileSync(path, whole.slice(cut));
      utimesSync(path, at, at); // Within the same tick of the clock: only its size says it grew.
    });
    await expect(readMailCode({ dir, to: 'ana@example.com', since, timeout: 3_000, interval: 10 })).resolves.toBe(
      '123456',
    );
  });

  it('never stops Node to look: no synchronous call on the folder or its files while it waits', async () => {
    const since = Date.now();
    write([{ body: '\n111111\n' }], since - 2_000);
    later(60, () => write([{ body: '\n555555\n' }], Date.now() + 10));
    await expect(readMailCode({ dir, to: 'ana@example.com', since, timeout: 3_000, interval: 10 })).resolves.toBe(
      '555555',
    );
    expect(syncCalls()).toEqual([0, 0, 0]);
  });

  it('answers the same mail to a second wait from the same moment: each wait looks on its own', async () => {
    const since = Date.now();
    write([{ body: '\n666666\n' }], since + 10);
    await expect(readMailCode({ dir, to: 'ana@example.com', since })).resolves.toBe('666666');
    await expect(readMailCode({ dir, to: 'ana@example.com', since })).resolves.toBe('666666');
  });

  it('looks again at a file gone between listing the folder and reading it, and fails on any other error', async () => {
    const since = Date.now();
    write([{ body: '\n777777\n' }], since + 10);
    vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 'ENOENT' }));
    await expect(readMailCode({ dir, to: 'ana@example.com', since, timeout: 3_000, interval: 10 })).resolves.toBe(
      '777777',
    );
    vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('permission denied'), { code: 'EACCES' }));
    await expect(readMailCode({ dir, to: 'ana@example.com', since, timeout: 3_000, interval: 10 })).rejects.toThrow(
      'permission denied',
    );
  });
});

describe('readMailsSince: the finished mails written from the action on, read without stopping Node', () => {
  it('answers the mails of the files written from `since` on, oldest first, never one written before', async () => {
    const since = Date.now();
    write([{ body: 'before\n' }], since - 2_000);
    write([{ body: 'a moment before\n' }], since - 100); // Beyond the clock's last tick: written before the action.
    write([{ body: 'second\n' }], since + 20);
    write([{ to: 'bo@example.com', body: 'first\n' }], since + 10);
    const mails = await readMailsSince({ dir, since });
    expect(mails.map((mail) => [mail.to, mail.body])).toEqual([
      [['bo@example.com'], 'first\n'],
      [['ana@example.com'], 'second\n'],
    ]);
  });

  it('forgives the clock’s last tick: a file stamped a few ms before `since` counts, as for a wait', async () => {
    const since = Date.now();
    write([{ body: 'tick\n' }], since - 20);
    expect((await readMailsSince({ dir, since })).map((mail) => mail.body)).toEqual(['tick\n']);
  });

  it('never reads a file written before the action, and never stops Node to look', async () => {
    const since = Date.now();
    const old = write([{ body: '\n111111\n' }], since - 2_000);
    write([{ body: '\n222222\n' }], since + 10);
    expect(await readMailsSince({ dir, since })).toHaveLength(1);
    expect(readsOf(old)).toBe(0);
    expect(syncCalls()).toEqual([0, 0, 0]);
  });

  it('reads each mail as readMails does: from the start of time, the same mails in the same order', async () => {
    const now = Date.now();
    write([{ to: 'Ana García <Ana@Example.com>', subject: '=?utf-8?q?C=C3=B3digo?=', body: 'one\n' }], now - 5_000);
    write([{ body: 'two\n' }, { to: 'bo@example.com', body: 'three\n' }], now - 1_000);
    expect(await readMailsSince({ dir, since: 0 })).toEqual(readMails(dir));
  });

  it('skips a message still being written (not closed yet)', async () => {
    const since = Date.now();
    const path = join(dir, 'open.log');
    writeFileSync(path, `${message({})}${CLOSE}${message({ body: 'half' })}`);
    utimesSync(path, (since + 10) / 1000, (since + 10) / 1000);
    expect(await readMailsSince({ dir, since })).toHaveLength(1);
  });

  it('is empty while nothing was mailed (the backend makes the folder with its first mail)', async () => {
    await expect(readMailsSince({ dir: join(dir, 'missing'), since: Date.now() })).resolves.toEqual([]);
  });

  it('leaves out a file gone between listing the folder and reading it, and fails on any other error', async () => {
    const since = Date.now();
    write([{ body: '\n777777\n' }], since + 10);
    vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('gone'), { code: 'ENOENT' }));
    await expect(readMailsSince({ dir, since })).resolves.toEqual([]);
    vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('permission denied'), { code: 'EACCES' }));
    await expect(readMailsSince({ dir, since })).rejects.toThrow('permission denied');
  });
});
