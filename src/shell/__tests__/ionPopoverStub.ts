// Test double of Ionic Vue's inline `IonPopover`, which presents itself only in a real browser: its content exists
// only while it is open. Ionic says `didDismiss` once the popover has played its way out; a test says it with
// `wrapper.getComponent(IonPopoverStub).vm.$emit('didDismiss')`.
import { defineComponent, h } from 'vue';

export const IonPopoverStub = defineComponent({
  name: 'IonPopover',
  inheritAttrs: false,
  props: { isOpen: Boolean, event: { type: null, default: undefined } },
  emits: ['didDismiss'],
  setup(props, { slots, attrs }) {
    return () => (props.isOpen ? h('div', { ...attrs, 'data-stub': 'ion-popover' }, slots.default?.()) : null);
  },
});
