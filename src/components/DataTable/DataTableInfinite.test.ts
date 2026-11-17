import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import DataTableInfinite from './DataTableInfinite.vue';

afterEach(() => {
  document.body.replaceChildren();
});

const TEN = Array.from({ length: 10 }, (_, i) => ({ id: i }));

/** A scroll host of `client` px showing `content` px, scrolled to `top`. */
function host(client: number, content: number, top = 0): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ion-content-scroll-host';
  Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => client });
  Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => content });
  el.scrollTop = top;
  document.body.append(el);
  return el;
}

function mountInfinite(props: Record<string, unknown> = {}, attachTo?: HTMLElement) {
  return mount(DataTableInfinite, {
    props: { disabled: false, shown: TEN, failed: false, waiting: false, label: 'Loading more apps…', ...props },
    attachTo,
  });
}
const scroller = (wrapper: ReturnType<typeof mountInfinite>) => wrapper.find('ion-infinite-scroll');

describe('DataTableInfinite', () => {
  it('is an Ionic infinite scroll with its loading text', () => {
    const wrapper = mountInfinite();
    expect(scroller(wrapper).exists()).toBe(true);
    const content = wrapper.find('ion-infinite-scroll-content').element as HTMLElement & { loadingText?: string };
    expect(content.loadingText).toBe('Loading more apps…');
  });

  it('reaching the end asks for more, once, and says so to assistive technology', async () => {
    const wrapper = mountInfinite();
    await scroller(wrapper).trigger('ionInfinite');
    await scroller(wrapper).trigger('ionInfinite');
    expect(wrapper.emitted('more')).toHaveLength(1);
    const status = wrapper.find('[role="status"]');
    expect(status.attributes('aria-live')).toBe('polite');
    expect(status.text()).toBe('Loading more apps…');
  });

  it('the next rows complete the load: the status goes quiet and the end can ask again', async () => {
    const wrapper = mountInfinite();
    const complete = vi.fn(() => Promise.resolve());
    Object.assign(scroller(wrapper).element, { complete });
    await scroller(wrapper).trigger('ionInfinite');
    await wrapper.setProps({ shown: [...TEN, ...TEN] });
    await flushPromises();
    expect(complete).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[role="status"]').text()).toBe('');
    await scroller(wrapper).trigger('ionInfinite');
    expect(wrapper.emitted('more')).toHaveLength(2);
  });

  it('other rows of the same length complete it too (a new search answered while it loaded)', async () => {
    const wrapper = mountInfinite();
    const complete = vi.fn(() => Promise.resolve());
    Object.assign(scroller(wrapper).element, { complete });
    await scroller(wrapper).trigger('ionInfinite');
    await wrapper.setProps({ shown: TEN.map((row) => ({ ...row })) });
    await flushPromises();
    expect(complete).toHaveBeenCalledTimes(1);
    await scroller(wrapper).trigger('ionInfinite');
    expect(wrapper.emitted('more')).toHaveLength(2);
  });

  it('a failed load or the end of the rows completes it too', async () => {
    for (const change of [{ failed: true }, { disabled: true }]) {
      const wrapper = mountInfinite();
      const complete = vi.fn(() => Promise.resolve());
      Object.assign(scroller(wrapper).element, { complete });
      await scroller(wrapper).trigger('ionInfinite');
      await wrapper.setProps(change);
      await flushPromises();
      expect(complete).toHaveBeenCalledTimes(1);
    }
  });

  it('switched off at the end: Ionic stops listening', () => {
    expect((scroller(mountInfinite({ disabled: true })).element as HTMLElement & { disabled?: boolean }).disabled).toBe(true);
  });

  it('rows that do not fill their scroll host ask for more by themselves, as there is nothing to scroll', async () => {
    const wrapper = mountInfinite({}, host(800, 500));
    await flushPromises();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await flushPromises();
    expect(wrapper.emitted('more')).toHaveLength(1);
  });

  it('rows that fill it wait for the scroll; disabled, or with no layout yet, it never asks', async () => {
    const filled = mountInfinite({}, host(800, 2000));
    const ended = mountInfinite({ disabled: true }, host(800, 500));
    const unlaid = mountInfinite({}, host(0, 0));
    await flushPromises();
    expect(filled.emitted('more')).toBeUndefined();
    expect(ended.emitted('more')).toBeUndefined();
    expect(unlaid.emitted('more')).toBeUndefined();
  });

  it('rows that change while the table is still loading do not complete the load: only the answer does', async () => {
    const wrapper = mountInfinite();
    const complete = vi.fn(() => Promise.resolve());
    Object.assign(scroller(wrapper).element, { complete });
    await scroller(wrapper).trigger('ionInfinite');
    await wrapper.setProps({ waiting: true, shown: [...TEN] });
    await flushPromises();
    expect(complete).not.toHaveBeenCalled();
    await wrapper.setProps({ waiting: false, shown: [...TEN, { id: 10 }] });
    await flushPromises();
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it('a load that brought no new row does not ask again by itself, even with the end in view', async () => {
    const wrapper = mountInfinite({}, host(800, 500));
    await flushPromises();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await flushPromises();
    expect(wrapper.emitted('more')).toHaveLength(1);
    await wrapper.setProps({ shown: [...TEN] });
    await flushPromises();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await flushPromises();
    expect(wrapper.emitted('more'), 'the same ten rows: no loop').toHaveLength(1);
    await wrapper.setProps({ shown: [...TEN, ...TEN] });
    await flushPromises();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await flushPromises();
    expect(wrapper.emitted('more'), 'more rows and still room: the next ones').toHaveLength(2);
  });

  it('an end Ionic reaches when nothing can be loaded is completed at once, so Ionic asks again later', async () => {
    const wrapper = mountInfinite({ disabled: true });
    const complete = vi.fn(() => Promise.resolve());
    Object.assign(scroller(wrapper).element, { complete });
    await scroller(wrapper).trigger('ionInfinite');
    expect(complete).toHaveBeenCalledTimes(1);
    expect(wrapper.emitted('more')).toBeUndefined();
  });
});
