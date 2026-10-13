// What a UserAvatar paints without a photo, as plain functions the shell can share (its own user
// menu, a member row): the initials and the tone of a person.
import type { UserAvatarTone } from './types';

/** The palette, in order; `brand` first, the mockups' default avatar. */
export const USER_AVATAR_TONES: readonly UserAvatarTone[] = Object.freeze(['brand', 'green', 'violet', 'amber']);

/** First letter or digit of a word (`(Ana)` → `A`, `🍞` → none). */
const firstSign = (word: string): string => /[\p{L}\p{N}]/u.exec(word)?.[0] ?? '';

/**
 * The first letters of the first two words of `name`; without a letter there, the first letter of
 * `email`; without either, `?`. Upper case: `laura martín` → `LM`.
 */
export function avatarInitials(name: string, email?: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map(firstSign)
    .filter(Boolean)
    .slice(0, 2)
    .join('');
  return (letters || firstSign(email ?? '') || '?').toUpperCase();
}

/**
 * The tone of the person behind `key` (their name; the email without one): a hash over the palette,
 * so the same person gets the same colour on every screen and in every session. Case and the spaces
 * around do not count.
 */
export function avatarTone(key: string): UserAvatarTone {
  // FNV-1a, 32 bits: tiny, stable across releases and well spread for short strings.
  let hash = 0x811c9dc5;
  for (const char of key.trim().toLowerCase()) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return USER_AVATAR_TONES[(hash >>> 0) % USER_AVATAR_TONES.length];
}
