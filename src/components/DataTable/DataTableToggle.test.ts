import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { defineComponent, h, ref } from 'vue';

import DataTableToggle from './DataTableToggle.vue';

type Toggle = HTMLElement & { checked?: boolean; disabled?: boolean };

/** A parent that answers each change as a page would: `busy` while its command runs, or nothing at all. */
function harness(answer: 'busy' | 'ignore') {
  const checked = ref(false);
  const busy = ref(false);
  const changes: boolean[] = [];
  const Parent = defineComponent({
    setup() {
      return () =>
        h(DataTableToggle, {
          checked: checked.value,
          busy: busy.value,
          label: 'Turn Invoicing on',
          busyLabel: 'Turning on…',
          onChange: (next: boolean) => {
            changes.push(next);
            if (answer === 'busy') busy.value = true;
          },
        });
    },
  });
  const wrapper = mount(Parent);
  const toggle = () => wrapper.find('ion-toggle').element as Toggle;
  /** The person flips it: Ionic moves its own switch, then tells. */
  async function flip(): Promise<void> {
    toggle().checked = !toggle().checked;
    toggle().dispatchEvent(new CustomEvent('ionChange', { detail: { checked: toggle().checked } }));
    await flushPromises();
  }
  return { wrapper, checked, busy, changes, toggle, flip };
}

describe('DataTableToggle', () => {
  it('an Ionic switch named for what it does, showing the real state', () => {
    const wrapper = mount(DataTableToggle, { props: { checked: true, label: 'Turn Invoicing off' } });
    const toggle = wrapper.find('ion-toggle').element as Toggle;
    expect(toggle.checked).toBe(true);
    expect(toggle.getAttribute('aria-label')).toBe('Turn Invoicing off');
  });

  it('a flip asks for the change and stays where it was put while it is on its way', async () => {
    const h = harness('busy');
    await h.flip();
    expect(h.changes).toEqual([true]);
    expect(h.toggle().checked).toBe(true);
    expect(h.wrapper.find('ion-spinner').attributes('aria-label')).toBe('Turning on…');
    expect(h.toggle().disabled).toBe(true);
  });

  it('done and confirmed by the data, it shows the new state', async () => {
    const h = harness('busy');
    await h.flip();
    h.checked.value = true;
    h.busy.value = false;
    await flushPromises();
    expect(h.toggle().checked).toBe(true);
    expect(h.wrapper.find('ion-spinner').exists()).toBe(false);
  });

  it('a change that failed goes back to the real state', async () => {
    const h = harness('busy');
    await h.flip();
    h.busy.value = false;
    await flushPromises();
    expect(h.toggle().checked).toBe(false);
  });

  it('a change the parent did not start (cancelled, refused) goes back at once', async () => {
    const h = harness('ignore');
    await h.flip();
    expect(h.changes).toEqual([true]);
    expect(h.toggle().checked).toBe(false);
  });

  it('disabled, it cannot be flipped', () => {
    const wrapper = mount(DataTableToggle, { props: { checked: true, disabled: true, label: 'Taxes' } });
    expect((wrapper.find('ion-toggle').element as Toggle).disabled).toBe(true);
  });

  it('a tap on it never opens the row', async () => {
    const row = document.createElement('div');
    const opened: string[] = [];
    row.addEventListener('click', () => opened.push('row'));
    document.body.append(row);
    const wrapper = mount(DataTableToggle, { props: { checked: false, label: 'x' }, attachTo: row });
    await wrapper.find('ion-toggle').trigger('click');
    expect(opened).toEqual([]);
    wrapper.unmount();
    row.remove();
  });
});
