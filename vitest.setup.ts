// Runs before every test file of this package: happy-dom made to behave as a browser where Ionic's
// runtime reaches it (`src/testing/happyDom.ts`), so its elements connect without logging errors.
import { fillHappyDomGaps } from "./src/testing/happyDom";

fillHappyDomGaps();
