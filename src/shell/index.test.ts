import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
      'ION_ICONS',
      'ionIconSrc',
      'resolveIcon',
      'HubIcon',
      'bootTheme',
      'toggleTheme',
      'toastError',
      'toastSuccess',
    ]) {
      expect(shell, name).toHaveProperty(name);
    }
  });

  it('no longer exports what left with OutfitKit and the icon generator (PLAN §16.11, §16.4)', () => {
    for (const name of [
      'registerOutfitkit',
      'registerOutfitkitIonicDeps',
      'bootActionFeedback',
      'iconRegistry',
      'resolveIconAsync',
      'ICON_SETS',
      'buildIconSvg',
      'ICON_CSS',
    ]) {
      expect(shell, name).not.toHaveProperty(name);
    }
  });

  it('exports the V5 shell: createShell, router, session, config, i18n and the page layout', () => {
    for (const name of [
      'createShell',
      'createShellRouter',
      'createAuthGate',
      'NOT_FOUND_ROUTE',
      'createShellSession',
      'provideSession',
      'useSession',
      'sessionReady',
      'SESSION_KEY',
      'provideShellConfig',
      'useShellConfig',
      'createShellI18n',
      'shellLocale',
      'AppPage',
      'AppTopbar',
    ]) {
      expect(shell, name).toHaveProperty(name);
    }
  });

  it('paints an icon of any registered set in ion-icon through ionIconSrc (the SaaS account pages use lucide)', () => {
    expect(shell.ionIconSrc('lucide:arrow-left')).toMatch(/^data:image\/svg\+xml;utf8,<svg /);
  });

  it('imports the boot hooks before any module that loads @ionic/vue (hub#1060)', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.ts'), 'utf8');
    const firstIonicUser = Math.min(
      ...["'./toast'", "'./createShell'", "'./AppPage.vue'", "'./router'"].map((m) => source.indexOf(m)),
    );
    for (const hook of ['ionic-fill', 'ionic-select-text', 'ionic-select-interface']) {
      const at = source.indexOf(`import './boot/${hook}.boot';`);
      expect(at, hook).toBeGreaterThan(-1);
      expect(at, hook).toBeLessThan(firstIonicUser);
    }
  });
});
