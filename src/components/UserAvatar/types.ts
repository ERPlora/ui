// Public types of UserAvatar.

/** `sm` 24px (dense rows), `md` 32px (lists, menus), `lg` 40px (the profile, a page header), `xl`
 *  72px (the account header). */
export type UserAvatarSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Colour of an avatar without a photo, from a small palette that reads AA in every theme: `brand`
 * is the theme's primary (the mockups' default avatar), the others its green, violet and amber.
 */
export type UserAvatarTone = 'brand' | 'green' | 'violet' | 'amber';
