// Runs before every test file of this package: happy-dom made to behave as a browser where Ionic's
// runtime reaches it (`src/testing/happyDom.ts`), so its elements connect without logging errors,
// and the shell's icons registered as `createShell` registers them at boot (`src/testing/icons.ts`),
// so an `ion-icon` paints by name instead of dumping a warning: a test has nothing to remember. The
// element classes are named as they register (`src/testing/elementNames.ts`), so a failing assertion
// prints an Ionic element as HTML instead of running out of memory on it.
import { nameElementClasses } from "./src/testing/elementNames";
import { fillHappyDomGaps } from "./src/testing/happyDom";
import { registerShellIcons } from "./src/testing/icons";

fillHappyDomGaps();
nameElementClasses();
registerShellIcons();
