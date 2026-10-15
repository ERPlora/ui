// The mails a Django app writes with its file backend (`django.core.mail.backends.filebased.EmailBackend`),
// read back as a person reads their inbox: the SaaS writes every mail of development to `saas-next/.mail/`
// (and its e2e to a folder of its own), and a sign-in there asks for the six-digit code it mailed. The
// samples below are what Django 6.1 writes: one file per connection named by an id (not by time), each
// message closed by a line of 79 `-`, its body raw UTF-8 (8bit), quoted-printable, base64 or multipart.
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MAIL_CODE, PASSWORD_RESET_LINK, readMailCode, readMails, readPasswordResetLink, waitForMail } from './mail';

const CLOSE = `\n${'-'.repeat(79)}\n`;

let dir: string;
let file = 0;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'erplora-mail-'));
});

afterEach(() => {
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
    setTimeout(() => write([{ body: '\n777777\n' }]), 150);
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
