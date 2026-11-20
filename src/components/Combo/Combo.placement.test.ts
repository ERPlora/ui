import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COUNTRIES, field, key, mountCombo, popover, resetAfterTest, settle, type Wrapper } from './__tests__/combo';
import { fakeFrames, frames, restoreWindow } from './__tests__/frames';

afterEach(resetAfterTest);

// Ionic places the popover once, when it presents, and a list the server fills was measured
// while it only said «Loading…»: on a tablet held landscape the categories then grew down past the
// window and the last ones could not be reached. The combo places its list itself, beside the field
// and inside the window, and keeps doing it on every frame while it is open.
describe('Combo: where the list opens', () => {
  beforeEach(fakeFrames);
  afterEach(restoreWindow);

  /** The window's height and where the field is in it, as Chrome measures them. */
  function layout(w: Wrapper, box: { top: number; bottom: number }, height: number): void {
    Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true });
    vi.spyOn(field(w).element, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 16, y: box.top, width: 448, height: box.bottom - box.top }),
    );
  }
  /** How tall the list would be with room for all of it (what its options and states measure). */
  function listHeight(w: Wrapper, px: number): void {
    vi.spyOn(popover(w).get('.combo__body').element as HTMLElement, 'offsetHeight', 'get').mockReturnValue(px);
  }
  async function frame(): Promise<void> {
    const pending = frames.splice(0);
    for (const cb of pending) cb(performance.now());
    await settle();
  }
  const placed = (w: Wrapper) => {
    const el = popover(w).element as HTMLElement;
    return {
      side: el.getAttribute('side'),
      maxHeight: el.style.getPropertyValue('--max-height'),
      top: el.style.getPropertyValue('--combo-top'),
      bottom: el.style.getPropertyValue('--combo-bottom'),
    };
  };

  it('under the field, a gap below it, as tall as the room left down to the window’s edge, without an arrow', async () => {
    const w = mountCombo();
    await settle();
    layout(w, { top: 100, bottom: 156 }, 800);
    await field(w).trigger('click');
    await settle();
    // 8 px of gap under the field and 8 px of edge: 800 − 156 − 16 = 628.
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '628px', top: '164px', bottom: 'auto' });
    expect(popover(w).attributes('arrow')).toBe('false');
  });

  it('over the field when the room under it is short and there is more over it (a tablet held landscape)', async () => {
    const w = mountCombo();
    await settle();
    // Measured at 1280×800 on «New menu» › «VAT category»: the field ends 154 px above the window's edge.
    layout(w, { top: 567, bottom: 646 }, 800);
    await field(w).trigger('click');
    await settle();
    expect(placed(w)).toEqual({ side: 'top', maxHeight: '551px', top: 'auto', bottom: '241px' });
  });

  it('over the field it ends a gap above it, so the floating label drawn on the field’s top border stays readable', async () => {
    const w = mountCombo();
    await settle();
    // Measured at 1280×800: the label «VAT category» starts 6 px above the field’s box (567); a list ending
    // at the box covered half of it.
    layout(w, { top: 567, bottom: 646 }, 800);
    await field(w).trigger('click');
    await settle();
    const { side, bottom } = placed(w);
    expect(side).toBe('top');
    const listEnd = 800 - parseFloat(bottom);
    expect(listEnd, 'the list ends at least 6 px above the field').toBeLessThanOrEqual(567 - 6);
  });

  it('a list that grows past the room under the field moves over it when there is more room there', async () => {
    const search = vi.fn(() => Promise.resolve(COUNTRIES));
    const w = mountCombo({ options: undefined, search });
    await settle();
    layout(w, { top: 420, bottom: 476 }, 800);
    await field(w).trigger('click');
    await settle();
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '308px', top: '484px', bottom: 'auto' });
    // The answer comes, taller than the room under the field (308 px) and there are 404 px over it.
    listHeight(w, 500);
    await frame();
    expect(placed(w)).toEqual({ side: 'top', maxHeight: '404px', top: 'auto', bottom: '388px' });
    // Typing narrows it: it fits where it is now, so it stays there (it does not jump under the field).
    listHeight(w, 64);
    await frame();
    expect(placed(w).side).toBe('top');
  });

  it('a list that fits under the field stays there, whatever the room over it', async () => {
    const w = mountCombo();
    await settle();
    layout(w, { top: 420, bottom: 476 }, 800);
    await field(w).trigger('click');
    await settle();
    listHeight(w, 300);
    await frame();
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '308px', top: '484px', bottom: 'auto' });
  });

  it('follows the field and the window while it is open (the keyboard shows up, the form scrolls)', async () => {
    const w = mountCombo();
    await settle();
    layout(w, { top: 100, bottom: 156 }, 800);
    await field(w).trigger('click');
    await settle();
    // The on-screen keyboard covers the lower 360 px (the visual viewport) and the form scrolls the field up.
    Object.defineProperty(window, 'visualViewport', { value: { offsetTop: 0, height: 440 }, configurable: true });
    layout(w, { top: 60, bottom: 116 }, 800);
    await frame();
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '308px', top: '124px', bottom: 'auto' });
    // The keyboard goes away and the form scrolls back: the next frame follows again.
    Reflect.deleteProperty(window, 'visualViewport');
    layout(w, { top: 100, bottom: 156 }, 800);
    await frame();
    expect(placed(w)).toEqual({ side: 'bottom', maxHeight: '628px', top: '164px', bottom: 'auto' });
  });

  it('stops following once closed', async () => {
    const w = mountCombo();
    await settle();
    layout(w, { top: 100, bottom: 156 }, 800);
    const measured = vi.mocked(field(w).element.getBoundingClientRect);
    await field(w).trigger('click');
    await settle();
    const atOpen = measured.mock.calls.length;
    await frame();
    expect(measured.mock.calls.length, 'a frame while open measures the field again').toBeGreaterThan(atOpen);
    await key(w, 'Escape');
    await frame();
    const atClose = measured.mock.calls.length;
    await frame();
    await frame();
    expect(measured.mock.calls.length, 'no frame measures it once closed').toBe(atClose);
  });
});
