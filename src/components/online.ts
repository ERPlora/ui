import { onScopeDispose, type Ref, shallowReadonly, shallowRef } from 'vue';

/** Whether the device has a network link (`navigator.onLine` and the window's `online`/`offline` events), while the
 *  calling component or scope lives. */
export function useOnline(): Readonly<Ref<boolean>> {
  const online = shallowRef(globalThis.navigator?.onLine !== false);
  const update = (event: Event) => {
    online.value = event.type === 'online';
  };
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  onScopeDispose(() => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  });
  return shallowReadonly(online);
}
