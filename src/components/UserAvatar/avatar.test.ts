// What a UserAvatar paints without a photo: the person's initials (first letters of the first two
// words of the name; else the first letter of the email; else «?») on one of a few tones, the same
// tone for the same person wherever the avatar appears (a hash of the name, the email without one).
import { describe, expect, it } from 'vitest';

import { avatarInitials, avatarTone, USER_AVATAR_TONES } from './avatar';

describe('avatarInitials', () => {
  it.each([
    ['Laura Martín', 'LM'],
    ['ana pérez', 'AP'],
    ['  María   José  Pérez ', 'MJ'],
    ['Ana', 'A'],
    ['élodie durand', 'ÉD'],
    ['Ñandú Ávila', 'ÑÁ'],
    ['(Ana) Gil', 'AG'],
    ['🍞 Bakery Team', 'BT'],
    ['José-Luis Ortega', 'JO'],
  ])('«%s» → %s', (name, expected) => {
    expect(avatarInitials(name)).toBe(expected);
  });

  it('a name always wins over the email', () => {
    expect(avatarInitials('Laura Martín', 'zoe@example.com')).toBe('LM');
  });

  it('without a usable name, the first letter of the email', () => {
    expect(avatarInitials('', 'laura@panaderialopez.es')).toBe('L');
    expect(avatarInitials('   ', ' marta@example.com')).toBe('M');
    expect(avatarInitials('— ·', '_ana@example.com')).toBe('A');
  });

  it('«?» when there is nothing to take a letter from', () => {
    expect(avatarInitials('')).toBe('?');
    expect(avatarInitials('  ', '  ')).toBe('?');
    expect(avatarInitials('', '@@')).toBe('?');
  });
});

describe('avatarTone', () => {
  it('is one of the palette’s tones, and the same for the same person every time', () => {
    for (const key of ['Laura Martín', 'ana@example.com', '', 'x']) {
      expect(USER_AVATAR_TONES).toContain(avatarTone(key));
      expect(avatarTone(key)).toBe(avatarTone(key));
    }
  });

  it('ignores case and surrounding spaces (the same person typed twice)', () => {
    expect(avatarTone('  LAURA MARTÍN ')).toBe(avatarTone('laura martín'));
  });

  it('spreads people over every tone of the palette', () => {
    const names = [
      'Laura Martín', 'Ana Pérez', 'Marta Gil', 'Juan López', 'Pedro Sánchez', 'Lucía Romero', 'Carlos Ruiz',
      'Elena Torres', 'Javier Díaz', 'Sofía Navarro', 'Diego Molina', 'Paula Ortega', 'Raúl Castro',
      'Irene Vega', 'Hugo Ramos', 'Clara Iglesias', 'Mario Blanco', 'Nuria Serrano', 'Óscar Medina', 'Sara Cano',
    ];
    expect(new Set(names.map(avatarTone))).toEqual(new Set(USER_AVATAR_TONES));
  });

  it('the palette is small and starts with the brand colour (the mockups’ default avatar)', () => {
    expect(USER_AVATAR_TONES).toEqual(['brand', 'green', 'violet', 'amber']);
  });
});
