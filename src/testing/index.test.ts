import { describe, expect, it } from 'vitest';

import pkg from '../../package.json';
import * as icons from './icons';
import * as testing from './index';

describe('@erplora/ui/testing (helpers for the tests of this package and of the apps; Node only)', () => {
  it('is a package entry point', () => {
    expect((pkg.exports as Record<string, string>)['./testing']).toBe('./src/testing/index.ts');
  });

  it('carries the icon guardrail: scanIcons, iconReferences and isRegisteredIcon', () => {
    expect(testing.scanIcons).toBe(icons.scanIcons);
    expect(testing.iconReferences).toBe(icons.iconReferences);
    expect(testing.isRegisteredIcon).toBe(icons.isRegisteredIcon);
  });
});
