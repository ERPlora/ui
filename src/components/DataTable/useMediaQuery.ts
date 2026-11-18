import { onBeforeUnmount, onMounted, type Ref, ref } from 'vue';

/** Whether the window matches `query` now, and as it changes while the component lives. */
export function useMediaQuery(query: string): Ref<boolean> {
  const media = typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
  const matches = ref(!!media?.matches);
  const follow = (event: { matches: boolean }): void => {
    matches.value = event.matches;
  };
  onMounted(() => media?.addEventListener('change', follow));
  onBeforeUnmount(() => media?.removeEventListener('change', follow));
  return matches;
}
