import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import ImageUpload from './ImageUpload.vue';
import * as entry from './index';

describe('ImageUpload entry points', () => {
  it('the folder exports the component', () => {
    expect(entry.ImageUpload).toBe(ImageUpload);
  });

  it('is part of `@erplora/ui/components` and of the package root', () => {
    expect((components as Record<string, unknown>).ImageUpload).toBe(ImageUpload);
    expect((root as Record<string, unknown>).ImageUpload).toBe(ImageUpload);
  });
});
