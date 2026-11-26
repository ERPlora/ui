import { onBeforeUnmount, type Ref, ref, watch } from 'vue';

export interface ScrollEdges {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

export function useScrollEdges(el: Readonly<Ref<HTMLElement | null | undefined>>, content: () => (Element | null | undefined)[] = () => []) {
  const edges = ref<ScrollEdges>({ left: false, right: false, top: false, bottom: false });

  function mark(): void {
    const box = el.value;
    if (!box) return;
    const hiddenX = box.scrollWidth - box.clientWidth;
    const hiddenY = box.scrollHeight - box.clientHeight;
    const now = {
      left: box.scrollLeft > 1,
      right: box.scrollLeft < hiddenX - 1,
      top: box.scrollTop > 1,
      bottom: box.scrollTop < hiddenY - 1,
    };
    const was = edges.value;
    if (now.left !== was.left || now.right !== was.right || now.top !== was.top || now.bottom !== was.bottom) edges.value = now;
  }

  let observer: ResizeObserver | null = null;
  let held: MutationObserver | null = null;
  function detach(box: HTMLElement | null | undefined): void {
    box?.removeEventListener('scroll', mark);
    observer?.disconnect();
    observer = null;
    held?.disconnect();
    held = null;
  }
  function attach(box: HTMLElement | null | undefined): void {
    if (!box) return;
    box.addEventListener('scroll', mark, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(mark);
      observer.observe(box);
      for (const node of content()) if (node) observer.observe(node);
    }
    // Items that arrive, or grow once drawn (a web component gets its class when it renders), widen what the box
    // holds without resizing the box itself.
    if (typeof MutationObserver !== 'undefined') {
      held = new MutationObserver(mark);
      held.observe(box, { childList: true, subtree: true, characterData: true, attributeFilter: ['class'] });
    }
    mark();
  }

  // The scroller may appear after the page: the zone strip waits for its zones.
  watch(
    el,
    (now, before) => {
      detach(before);
      attach(now);
    },
    { immediate: true, flush: 'post' },
  );
  onBeforeUnmount(() => detach(el.value));

  return { edges, mark };
}
