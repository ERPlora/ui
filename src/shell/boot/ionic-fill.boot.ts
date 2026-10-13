// Fixes ERPlora/hub#1060 (see ./ionic-fill).
// Side-effect module, imported FIRST by the shell entry point; see `./ionic-fill` for the why.
//
// It cannot be a call in the shell entry point's body: ES modules evaluate every `import` before the first
// statement of the importing module, and `@ionic/vue` registers `ion-input`/`ion-select`/
// `ion-textarea` on import (`defineContainer()` → `defineCustomElement()`). By then the custom
// element definitions are frozen — the HTML spec captures their lifecycle callbacks inside
// `customElements.define` — and there is nothing left to hook. Import order IS the fix.
import { bootIonicFillMode } from './ionic-fill';

bootIonicFillMode();
