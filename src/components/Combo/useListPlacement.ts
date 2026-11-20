import { computed, onBeforeUnmount, type Ref, ref } from 'vue';

/** Space kept between the list and the edge of the window. */
const EDGE = 8;
/** Space kept between the list and the field: over it, the floating label drawn on the field's top
 *  border (half of it above the field's box) stays readable. */
const GAP = 8;
/** Opening with less room than this under the field (about four options) and more over it: over it. */
const SHORT_ROOM = 240;

interface Placement {
  side: 'bottom' | 'top';
  /** The list's highest height: the room on its side, down (or up) to the window's edge. */
  room: number;
  /** Under the field: where the list starts (a gap under the field), from the window's top. */
  top: number;
  /** Over the field: where the list ends (a gap over the field), from the window's bottom. */
  bottom: number;
}

/** The part of the window the person sees: the on-screen keyboard and the zoom leave the rest out. */
function visible(): { top: number; bottom: number } {
  const view = window.visualViewport;
  return view ? { top: view.offsetTop, bottom: view.offsetTop + view.height } : { top: 0, bottom: window.innerHeight };
}

/** Whether the list goes somewhere else: the same placement is not set again, so nothing is painted again. */
function moved(next: Placement, now: Placement): boolean {
  return next.side !== now.side || next.room !== now.room || next.top !== now.top || next.bottom !== now.bottom;
}

/** Where the list goes, beside the field and inside the window, and the popover's style that puts it there. */
function usePlacement(field: () => HTMLElement | null) {
  const placement = ref<Placement>({ side: 'bottom', room: 0, top: 0, bottom: 0 });
  /** The options and states as tall as they are: the list's height with room for all of it. */
  const body = ref<HTMLElement | null>(null);

  const popoverStyle = computed(() => {
    const { side, room, top, bottom } = placement.value;
    return {
      '--max-height': `${room}px`,
      '--combo-top': side === 'bottom' ? `${top}px` : 'auto',
      '--combo-bottom': side === 'top' ? `${bottom}px` : 'auto',
    };
  });

  /** Puts the list beside the field, inside the window. Opening (its size not known yet): under the
   *  field unless the room there is short and there is more over it. Open: it stays on its side while
   *  it fits there, and moves to the other one when it does not and there is more room there. */
  function place(opening = false): void {
    const el = field();
    if (!el) return;
    const box = el.getBoundingClientRect();
    const view = visible();
    const below = Math.max(0, Math.floor(view.bottom - box.bottom - GAP - EDGE));
    const above = Math.max(0, Math.floor(box.top - view.top - GAP - EDGE));
    let side = placement.value.side;
    if (opening) {
      side = below < SHORT_ROOM && above > below ? 'top' : 'bottom';
    } else {
      const wanted = body.value?.offsetHeight ?? 0;
      const [room, other] = side === 'bottom' ? [below, above] : [above, below];
      if (wanted > room && other > room) side = side === 'bottom' ? 'top' : 'bottom';
    }
    const next: Placement = {
      side,
      room: side === 'bottom' ? below : above,
      top: box.bottom + GAP,
      bottom: window.innerHeight - box.top + GAP,
    };
    const now = placement.value;
    if (moved(next, now)) placement.value = next;
  }

  return { placement, body, popoverStyle, place };
}

/** Where the list beside the field goes, placed again on every frame while it is open. */
export function useListPlacement(field: () => HTMLElement | null, open: Ref<boolean>) {
  const { placement, body, popoverStyle, place } = usePlacement(field);
  let frame: number | undefined;

  /** On every frame while the list is open (the list grows, the field moves, the keyboard shows up). */
  function follow(): void {
    if (!open.value) return;
    place();
    frame = requestAnimationFrame(follow);
  }

  function stopFollowing(): void {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
  }

  function startFollowing(): void {
    stopFollowing();
    frame = requestAnimationFrame(follow);
  }

  onBeforeUnmount(stopFollowing);

  return { placement, body, popoverStyle, place, startFollowing, stopFollowing };
}
