import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

import { useListPlacement } from './useListPlacement';

const realInnerHeight = window.innerHeight;
/** The animation frames asked, run by hand. */
let frames: FrameRequestCallback[];

beforeEach(() => {
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => frames.push(cb));
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, 'innerHeight', { value: realInnerHeight, configurable: true, writable: true });
  Reflect.deleteProperty(window, 'visualViewport');
});

const boxOf = (top: number, bottom: number) => DOMRect.fromRect({ x: 16, y: top, width: 448, height: bottom - top });

/** A field from `top` to `bottom` px down a window `height` px tall, with a list placed beside it. */
function setup(top: number, bottom: number, height = 800) {
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true });
  const field = document.createElement('div');
  const box = vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(boxOf(top, bottom));
  const target = ref<HTMLElement | null>(field);
  const open = ref(false);
  let list!: ReturnType<typeof useListPlacement>;
  const host = mount(
    defineComponent({
      setup() {
        list = useListPlacement(() => target.value, open);
        return () => h('div');
      },
    }),
  );
  return { ...list, box, target, open, host };
}

function runFrames(): void {
  for (const cb of frames.splice(0)) cb(performance.now());
}

describe('useListPlacement: opening', () => {
  it('under the field: a gap below it, as tall as the room left down to the window’s edge', () => {
    const list = setup(100, 156);
    list.place(true);
    // 8 px of gap under the field and 8 px of edge: 800 − 156 − 16 = 628.
    expect(list.placement.value).toEqual({ side: 'bottom', room: 628, top: 164, bottom: 708 });
    expect(list.popoverStyle.value).toEqual({ '--max-height': '628px', '--combo-top': '164px', '--combo-bottom': 'auto' });
  });

  it('over the field when the room under it is short and there is more over it, ending a gap above it', () => {
    const list = setup(567, 646);
    list.place(true);
    expect(list.placement.value).toEqual({ side: 'top', room: 551, top: 654, bottom: 241 });
    expect(list.popoverStyle.value).toEqual({ '--max-height': '551px', '--combo-top': 'auto', '--combo-bottom': '241px' });
  });

  it('under the field with room for about four options (240 px), even with more over it', () => {
    const list = setup(488, 544);
    list.place(true);
    expect(list.placement.value).toMatchObject({ side: 'bottom', room: 240 });
  });

  it('under the field when the room is short on both sides and shorter over it', () => {
    const list = setup(100, 156, 300);
    list.place(true);
    expect(list.placement.value).toMatchObject({ side: 'bottom', room: 128 });
  });

  it('only in the part of the window the person sees: the on-screen keyboard and the zoom leave the rest out', () => {
    const list = setup(60, 116);
    Object.defineProperty(window, 'visualViewport', { value: { offsetTop: 20, height: 420.5 }, configurable: true });
    list.place(true);
    // Under it: 20 + 420.5 − 116 − 16, down to whole pixels. Over it: 60 − 20 − 16 = 24.
    expect(list.placement.value).toEqual({ side: 'bottom', room: 308, top: 124, bottom: 748 });
  });

  it('without a field it stays where it was', () => {
    const list = setup(100, 156);
    list.target.value = null;
    list.place(true);
    expect(list.placement.value).toEqual({ side: 'bottom', room: 0, top: 0, bottom: 0 });
  });
});

describe('useListPlacement: open', () => {
  it('a list taller than the room on its side moves where there is more room, and stays there while that holds', () => {
    const list = setup(420, 476);
    list.place(true);
    expect(list.placement.value).toEqual({ side: 'bottom', room: 308, top: 484, bottom: 388 });
    list.body.value = { offsetHeight: 500 } as HTMLElement;
    list.place();
    expect(list.placement.value).toEqual({ side: 'top', room: 404, top: 484, bottom: 388 });
    // Taller than the room over the field too, but there is less under it: it stays.
    list.place();
    expect(list.placement.value.side).toBe('top');
    list.body.value = { offsetHeight: 64 } as HTMLElement;
    list.place();
    expect(list.placement.value.side).toBe('top');
  });

  it('a list that fits stays on its side, whatever the room on the other', () => {
    const list = setup(420, 476);
    list.place(true);
    list.body.value = { offsetHeight: 308 } as HTMLElement;
    list.place();
    expect(list.placement.value).toMatchObject({ side: 'bottom', room: 308 });
  });

  it('the same place keeps the same placement, so nothing is painted again', () => {
    const list = setup(100, 156);
    list.place(true);
    const before = list.placement.value;
    list.place();
    expect(list.placement.value).toBe(before);
  });
});

describe('useListPlacement: following', () => {
  it('places the list again on every frame while open, and stops at the first frame once closed', () => {
    const list = setup(100, 156);
    list.open.value = true;
    list.place(true);
    list.startFollowing();
    expect(frames).toHaveLength(1);
    // The form scrolls the field up.
    list.box.mockReturnValue(boxOf(60, 116));
    runFrames();
    expect(list.placement.value).toEqual({ side: 'bottom', room: 668, top: 124, bottom: 748 });
    expect(frames, 'it asks for the next frame').toHaveLength(1);
    list.open.value = false;
    list.box.mockReturnValue(boxOf(100, 156));
    runFrames();
    expect(list.placement.value.top, 'a frame once closed does not measure').toBe(124);
    expect(frames).toHaveLength(0);
  });

  it('starting again cancels the frame already asked, and stopping cancels it once', () => {
    const list = setup(100, 156);
    list.open.value = true;
    list.startFollowing();
    list.startFollowing();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
    list.stopFollowing();
    list.stopFollowing();
    expect(vi.mocked(window.cancelAnimationFrame).mock.calls).toEqual([[1], [2]]);
  });

  it('stops following when the component around it goes away', () => {
    const list = setup(100, 156);
    list.open.value = true;
    list.startFollowing();
    list.host.unmount();
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(1);
  });
});
