/**
 * The zoom an element is painted with: the interface size `setThemeScale` puts on <html>. What the browser measures
 * (`getBoundingClientRect`, the window's size, a pointer's `clientX`/`clientY`) comes in screen pixels, while a
 * `top`, `left` or `max-height` written on the page is in its own CSS pixels, which the zoom scales again: divide the
 * first by this before writing it. 1 where the browser does not say (`Element.currentCSSZoom`).
 */
export function cssZoomOf(el: Element): number {
  const zoom: unknown = (el as Element & { currentCSSZoom?: unknown }).currentCSSZoom;
  return typeof zoom === 'number' && zoom > 0 ? zoom : 1;
}
