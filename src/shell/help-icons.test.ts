import { describe, expect, it } from 'vitest';

import { HELP_ION_ICONS } from './help-icons';
import { ION_ICONS } from './icons';

describe('HELP_ION_ICONS', () => {
  it('are the Ionicons of the in-app help window, frozen and part of the shell registry', () => {
    expect(Object.isFrozen(HELP_ION_ICONS)).toBe(true);
    expect(Object.keys(HELP_ION_ICONS).sort()).toEqual(['location-outline', 'play']);
    for (const [name, src] of Object.entries(HELP_ION_ICONS)) expect(ION_ICONS[name], name).toBe(src);
  });
});
