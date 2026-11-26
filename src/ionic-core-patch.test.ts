import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The chunk of the custom-elements build (the one @ionic/vue loads) that places `ion-popover`. */
function popoverChunk(): string {
  const require = createRequire(import.meta.url);
  const vue = dirname(require.resolve('@ionic/vue/package.json'));
  const components = join(dirname(require.resolve('@ionic/core/package.json', { paths: [vue] })), 'components');
  const entry = readFileSync(join(components, 'ion-popover.js'), 'utf8');
  const chunk = /from"\.\/(p-[\w-]+\.js)"/.exec(entry)?.[1];
  expect(chunk, 'ion-popover.js imports the popover from a chunk').toBeDefined();
  return readFileSync(join(components, chunk as string), 'utf8');
}

describe('@ionic/core patch', () => {
  it('places a popover in the CSS pixels of a zoomed page: the zoom read once, every box divided by it', () => {
    const source = popoverChunk();
    expect(source).toContain('currentCSSZoom');
    // The window, in both enter animations (ios and md).
    expect(source.match(/innerWidth\/zoom/g)).toHaveLength(2);
    expect(source.match(/innerHeight\/zoom/g)).toHaveLength(2);
    // The trigger's box and the point of a click.
    expect(source).toContain('h={top:e.top/zoom,left:e.left/zoom,width:e.width/zoom,height:e.height/zoom}');
    expect(source).toContain('h={top:d.clientY/zoom,left:d.clientX/zoom,width:1,height:1}');
    // The popover's own size, a cover popover's width and the arrow.
    expect(source).toContain('i=r.height/zoom;let s=r.width/zoom');
    expect(source).toContain('o.getBoundingClientRect().width/zoom');
    expect(source).toContain('return{arrowWidth:e/zoom,arrowHeight:o/zoom}');
  });
});
