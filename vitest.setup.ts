// Runs before every test file of this package: happy-dom made to behave as a browser where Ionic's
// runtime reaches it (`src/testing/happyDom.ts`), so its elements connect without logging errors,
// and the shell's icons registered as `createShell` registers them at boot (`src/testing/icons.ts`),
// so an `ion-icon` paints by name instead of dumping a warning: a test has nothing to remember.
import { fillHappyDomGaps } from "./src/testing/happyDom";
import { registerShellIcons } from "./src/testing/icons";

fillHappyDomGaps();
registerShellIcons();
