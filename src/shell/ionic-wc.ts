// Ionic Web Components that the `ok-*` elements of OutfitKit use INSIDE their own shadow roots.
// The shell's Vue views get their `ion-*` from `@ionic/vue`; the Lit components of OutfitKit just
// render `<ion-button>`, `<ion-input>`... and need those tags defined too. Ported from ERPlora hub
// `apps/web/src/lib/ionic-wc.ts`. Per-component imports from `@ionic/core/components/*` keep the
// bundle to what is listed here.
import { defineCustomElement as ionActionSheet } from '@ionic/core/components/ion-action-sheet.js';
import { defineCustomElement as ionAlert } from '@ionic/core/components/ion-alert.js';
import { defineCustomElement as ionButton } from '@ionic/core/components/ion-button.js';
import { defineCustomElement as ionCard } from '@ionic/core/components/ion-card.js';
import { defineCustomElement as ionCardContent } from '@ionic/core/components/ion-card-content.js';
import { defineCustomElement as ionCardHeader } from '@ionic/core/components/ion-card-header.js';
import { defineCustomElement as ionCheckbox } from '@ionic/core/components/ion-checkbox.js';
import { defineCustomElement as ionIcon } from '@ionic/core/components/ion-icon.js';
import { defineCustomElement as ionInput } from '@ionic/core/components/ion-input.js';
import { defineCustomElement as ionModal } from '@ionic/core/components/ion-modal.js';
import { defineCustomElement as ionSearchbar } from '@ionic/core/components/ion-searchbar.js';
import { defineCustomElement as ionSelect } from '@ionic/core/components/ion-select.js';
import { defineCustomElement as ionSelectOption } from '@ionic/core/components/ion-select-option.js';
import { defineCustomElement as ionSpinner } from '@ionic/core/components/ion-spinner.js';
import { defineCustomElement as ionToast } from '@ionic/core/components/ion-toast.js';

const DEFINITIONS: ReadonlyArray<readonly [string, () => void]> = [
  ['ion-button', ionButton],
  ['ion-icon', ionIcon],
  ['ion-input', ionInput],
  ['ion-searchbar', ionSearchbar],
  ['ion-select', ionSelect],
  ['ion-select-option', ionSelectOption],
  ['ion-modal', ionModal],
  ['ion-action-sheet', ionActionSheet],
  ['ion-toast', ionToast],
  ['ion-alert', ionAlert],
  ['ion-card', ionCard],
  ['ion-card-header', ionCardHeader],
  ['ion-card-content', ionCardContent],
  ['ion-checkbox', ionCheckbox],
  ['ion-spinner', ionSpinner],
];

/** Tags registered by {@link registerOutfitkitIonicDeps}. */
export const IONIC_WC_TAGS: readonly string[] = DEFINITIONS.map(([tag]) => tag);

/**
 * Defines the `ion-*` elements OutfitKit depends on. Idempotent: a tag that is already registered
 * (by `@ionic/vue` or an earlier call) is skipped.
 */
export function registerOutfitkitIonicDeps(): void {
  for (const [tag, define] of DEFINITIONS) {
    if (!customElements.get(tag)) define();
  }
}
