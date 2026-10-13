// Test double of Ionic Vue's inline `IonModal` (an overlay only presents itself in a real browser,
// like the DataTable's `ion-popover`). It keeps the contract our dialogs rely on:
//   - the `ion-modal` element is always there (attributes on it); its content exists only while
//     presented, inside `div.ion-delegate-host.ion-page`, as Ionic Vue renders it;
//   - `isOpen` true → `willPresent`, then `didPresent` on the next tick; false → `willDismiss` and
//     `didDismiss` (detail `{ role }`);
//   - like Ionic's overlay manager, Escape on the document and a tap on the backdrop dismiss it with
//     role `backdrop` only when `backdropDismiss` is not false (`tapBackdrop()` is that tap).
// Use it with `vi.mock('@ionic/vue', …)` so every IonModal of the tree (also one rendered outside
// the test's mount, like `useConfirm`'s) is this one.
import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';

export interface IonModalStubApi {
  /** Ionic dismissing on its own (backdrop, Escape, hardware back), with that role. */
  dismiss(role?: string): boolean;
  /** A tap on the backdrop: dismisses with role `backdrop` when `backdropDismiss` allows it. */
  tapBackdrop(): boolean;
}

const APIS = new WeakMap<Element, IonModalStubApi>();

/** The stub behind an `ion-modal` element (`[data-stub="ion-modal"]`), wherever it was rendered. */
export function ionModalStubOf(el: Element | null): IonModalStubApi {
  const api = el ? APIS.get(el) : undefined;
  if (!api) throw new Error('not an IonModal stub');
  return api;
}

const dismissEvent = (type: string, role: string | undefined): CustomEvent =>
  new CustomEvent(type, { detail: { data: undefined, role } });

export const IonModalStub = defineComponent({
  name: 'IonModal',
  inheritAttrs: false,
  props: {
    isOpen: { type: Boolean, default: false },
    backdropDismiss: { type: Boolean, default: true },
  },
  emits: ['willPresent', 'didPresent', 'willDismiss', 'didDismiss'],
  setup(props, { attrs, slots, emit, expose }) {
    const presented = shallowRef(false);

    function present(): void {
      if (presented.value) return;
      presented.value = true;
      emit('willPresent');
      void nextTick().then(() => emit('didPresent'));
    }

    function dismiss(role?: string): boolean {
      if (!presented.value) return false;
      presented.value = false;
      emit('willDismiss', dismissEvent('willDismiss', role));
      emit('didDismiss', dismissEvent('didDismiss', role));
      return true;
    }

    const tapBackdrop = (): boolean => props.backdropDismiss && dismiss('backdrop');

    function onDocumentKeydown(event: KeyboardEvent): void {
      if (event.key === 'Escape') tapBackdrop();
    }

    const host = useTemplateRef<HTMLElement>('host');
    onMounted(() => {
      if (host.value) APIS.set(host.value, { dismiss, tapBackdrop });
      document.addEventListener('keydown', onDocumentKeydown);
      if (props.isOpen) present();
    });
    onBeforeUnmount(() => document.removeEventListener('keydown', onDocumentKeydown));
    watch(
      () => props.isOpen,
      (open) => (open ? present() : dismiss()),
    );

    expose({ dismiss, tapBackdrop } satisfies IonModalStubApi);

    return () =>
      h(
        'div',
        { ...attrs, ref: 'host', 'data-stub': 'ion-modal', 'data-backdrop-dismiss': String(props.backdropDismiss) },
        presented.value ? [h('div', { class: 'ion-delegate-host ion-page' }, slots.default?.())] : [],
      );
  },
});
