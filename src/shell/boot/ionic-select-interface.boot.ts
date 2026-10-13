// Fixes ERPlora/hub#2223 (see ./ionic-select-interface).
// Side-effect module, imported by the shell entry point next to `./ionic-fill.boot` and
// `./ionic-select-text.boot` — see `./ionic-select-interface` for the why.
import { bootIonicSelectInterface } from './ionic-select-interface';

bootIonicSelectInterface();
