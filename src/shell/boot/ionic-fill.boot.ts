// Side-effect module, imported FIRST by the shell entry point. It cannot be a call in the entry point's body: ES
// modules evaluate every `import` before the importer's first statement, and `@ionic/vue` defines `ion-input`,
// `ion-select` and `ion-textarea` on import. Once defined, their lifecycle callbacks are captured by
// `customElements.define` and there is nothing left to hook, so import order is the fix.
import { bootIonicFillMode } from './ionic-fill';

bootIonicFillMode();
