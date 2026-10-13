import { describe, expect, it } from 'vitest';

import * as shell from './index';

describe('shell barrel', () => {
  it('exports what the entry point needs', () => {
    for (const name of [
      'patchIonicOnDefine',
      'bootIonicFillMode',
      'bootIonicSelectInterface',
      'bootIonicSelectText',
      'setSelectTextTranslator',
      'installTrustedTypesPolicy',
      'iconRegistry',
      'resolveIcon',
      'resolveIconAsync',
      'ICON_CSS',
      'registerOutfitkit',
      'registerOutfitkitIonicDeps',
      'bootTheme',
      'toggleTheme',
      'toastError',
      'toastSuccess',
      'bootActionFeedback',
    ]) {
      expect(shell, name).toHaveProperty(name);
    }
  });
});
