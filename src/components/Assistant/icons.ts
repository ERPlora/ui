// The icons of the assistant's composer and its answers that the shell's registry does not name (paperclip,
// microphone, stop, speaker): baked at build time exactly as the shell bakes its non-Ionicons sets (`unplugin-icons`,
// raw compiler, `erploraVite()`), painted with `ion-icon`'s `src` as a `data:` URL — nothing is fetched. Exported for
// a host's own key that dictates (the Hub's till's «Speak»).
import paperclip from '~icons/lucide/paperclip';
import mic from '~icons/lucide/mic';
import square from '~icons/lucide/square';
import volume from '~icons/lucide/volume-2';

const svgUrl = (svg: string): string => `data:image/svg+xml;utf8,${svg}`;

export const ASSISTANT_ICONS = Object.freeze({
  attach: svgUrl(paperclip),
  mic: svgUrl(mic),
  stop: svgUrl(square),
  listen: svgUrl(volume),
});
