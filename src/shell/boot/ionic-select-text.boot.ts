// Fixes ERPlora/hub#1736 (see ./ionic-select-text).
// Side-effect module, imported by `the shell entry point` next to `./ionic-fill.boot` and
// `./ionic-select-interface.boot` — see `./ionic-select-text` for the why.
import { bootIonicSelectText } from './ionic-select-text';

bootIonicSelectText();
