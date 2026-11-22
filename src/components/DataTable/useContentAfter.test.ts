import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { defineComponent, h, nextTick, onMounted, type Ref, ref } from 'vue';

import { useContentAfter } from './useContentAfter';

/** The observer reports after the change that fired it. */
const observed = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

/** A table in its parent, watched as the layout does: once mounted, and again when `fill` changes. */
function mountTable(fill = ref(true)) {
  const writes: boolean[] = [];
  let contentAfter: Ref<boolean> | undefined;
  const Table = defineComponent({
    setup() {
      const root = ref<HTMLElement | null>(null);
      const part = useContentAfter({ root, fill: () => fill.value }, (target, value) => {
        writes.push(value as boolean);
        target.value = value;
      });
      contentAfter = part.contentAfter;
      onMounted(() => part.observeSiblings());
      return () => h('div', { ref: root }, h('span'));
    },
  });
  const host = document.createElement('section');
  document.body.append(host);
  const wrapper = mount(Table, { attachTo: host });
  const table = wrapper.element as HTMLElement;
  const parent = table.parentElement as HTMLElement;
  const sibling = (style = ''): HTMLElement => {
    const el = document.createElement('p');
    el.setAttribute('style', style);
    parent.append(el);
    return el;
  };
  return { wrapper, table, parent, sibling, writes, fill, after: () => contentAfter?.value };
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('useContentAfter: is there content in flow after a table that fills its parent?', () => {
  it('a sibling in flow after the table counts; a hidden, absolute or fixed one does not', async () => {
    const { sibling, after } = mountTable();
    expect(after()).toBe(false);
    const p = sibling();
    await observed();
    expect(after()).toBe(true);
    for (const style of ['display: none', 'position: absolute', 'position: fixed']) {
      p.setAttribute('style', style);
      await observed();
      expect(after(), style).toBe(false);
    }
    p.setAttribute('style', 'position: relative');
    await observed();
    expect(after()).toBe(true);
  });

  it('tells the layout each reading, so the measurement pass waits for what it paints', async () => {
    const { sibling, writes } = mountTable();
    sibling();
    await observed();
    expect(writes).toEqual([false, true]);
  });

  it('only what follows the table counts', async () => {
    const { table, parent, after } = mountTable();
    parent.insertBefore(document.createElement('p'), table);
    await observed();
    expect(after()).toBe(false);
  });

  it('without fill nothing is watched, and turning it on reads the parent at once', async () => {
    const { sibling, after, fill } = mountTable(ref(false));
    sibling();
    await observed();
    expect(after()).toBe(false);
    fill.value = true;
    await nextTick();
    expect(after()).toBe(true);
  });

  it('a change inside the table or deep inside a sibling does not read the parent again', async () => {
    const { table, sibling, writes } = mountTable();
    const inner = sibling().appendChild(document.createElement('b'));
    await observed();
    const before = writes.length;
    table.append(document.createElement('i'));
    table.setAttribute('class', 'wide');
    inner.append(document.createElement('i'));
    inner.setAttribute('class', 'bold');
    await observed();
    expect(writes.length).toBe(before);
  });

  it('stops watching once the table is unmounted', async () => {
    const { wrapper, parent, writes } = mountTable();
    const before = writes.length;
    wrapper.unmount();
    parent.append(document.createElement('p'));
    await observed();
    expect(writes.length).toBe(before);
  });
});
