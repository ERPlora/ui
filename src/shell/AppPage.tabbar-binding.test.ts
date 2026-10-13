// The page wires its footer strip whenever it appears (hub#1734), ported from ERPlora hub
// `AppPage.late-tabbar.hub1734.test.ts`: `bindTabbar` (overflow fade, checked tab in view, mouse
// drag) and `bindTabbarPeek` (the next tab peeks on a phone, hub#1830). Both for the strip AppPage
// paints from `tabs` and for one a view puts in the `#footer` slot (a module's own tabs, which can
// arrive over the network after the layout mounted):
//   • a strip that arrives LATE is wired all the same;
//   • a strip already there is wired exactly once, however the screen re-renders;
//   • a strip that goes away is unwired, and leaving the screen unwires and stops watching.
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const untie = vi.fn();
const untiePeek = vi.fn();
const bindTabbar = vi.fn<(segment: HTMLElement) => () => void>(() => untie);
const bindTabbarPeek = vi.fn<(segment: HTMLElement) => () => void>(() => untiePeek);
vi.mock('./tabbar', () => ({ bindTabbar: (el: HTMLElement) => bindTabbar(el) }));
vi.mock('./tabbar-peek', () => ({ bindTabbarPeek: (el: HTMLElement) => bindTabbarPeek(el) }));

import AppPage from './AppPage.vue';
import { createShellI18n } from './i18n';

const TABS = [
  { id: 'a', label: 'A', icon: 'ion:cube-outline' },
  { id: 'b', label: 'B', icon: 'ion:list-outline' },
];

/** A screen whose tabs arrive late, painted by AppPage (`tabs`) or by the view (`#footer`). */
const Screen = defineComponent({
  components: { AppPage },
  props: { own: { type: Boolean, default: false } },
  setup() {
    return { tabs: ref<typeof TABS>([]) };
  },
  template: `
    <AppPage title="Screen" :tabs="own ? [] : tabs">
      <p>content</p>
      <template #footer>
        <ion-footer v-if="own && tabs.length > 1">
          <ion-toolbar>
            <ion-segment class="module-tabbar">
              <ion-segment-button v-for="t in tabs" :key="t.id" :value="t.id">{{ t.label }}</ion-segment-button>
            </ion-segment>
          </ion-toolbar>
        </ion-footer>
      </template>
    </AppPage>
  `,
});

let screen: ReturnType<typeof mount> | null = null;

function mountScreen(own = false) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div />' } }] });
  screen = mount(Screen, {
    props: { own },
    global: { plugins: [router, createShellI18n({ locale: 'en' })] },
    attachTo: document.body,
  });
  return screen as ReturnType<typeof mount> & { vm: { tabs: typeof TABS } };
}

const stripOf = (s: ReturnType<typeof mount>) => s.element.querySelector('ion-footer ion-segment');

beforeEach(() => {
  bindTabbar.mockClear();
  bindTabbarPeek.mockClear();
  untie.mockClear();
  untiePeek.mockClear();
});

afterEach(() => {
  screen?.unmount();
  screen = null;
  document.body.innerHTML = '';
});

describe.each([
  ['the tabs AppPage paints', false],
  ['a strip the view puts in #footer', true],
])('AppPage wires %s whenever it appears (hub#1734)', (_name, own) => {
  it('wires a strip that arrives AFTER mount, with both binders', async () => {
    const s = mountScreen(own);
    await nextTick();
    expect(bindTabbar).not.toHaveBeenCalled();

    s.vm.tabs = TABS;
    await flushPromises();
    const segment = stripOf(s);
    expect(segment).not.toBeNull();
    expect(bindTabbar).toHaveBeenCalledTimes(1);
    expect(bindTabbar.mock.calls[0][0]).toBe(segment);
    expect(bindTabbarPeek).toHaveBeenCalledTimes(1);
    expect(bindTabbarPeek.mock.calls[0][0]).toBe(segment);
  });

  it('wires it exactly once, however the screen re-renders', async () => {
    const s = mountScreen(own);
    s.vm.tabs = TABS;
    await flushPromises();
    s.vm.tabs = [...TABS, { id: 'c', label: 'C', icon: 'ion:add' }];
    await flushPromises();
    expect(bindTabbar).toHaveBeenCalledTimes(1);
    expect(untie).not.toHaveBeenCalled();
  });

  it('unwires (peek first, then the strip) when the strip goes away', async () => {
    const s = mountScreen(own);
    s.vm.tabs = TABS;
    await flushPromises();
    s.vm.tabs = own ? [TABS[0]] : [];
    await flushPromises();
    expect(stripOf(s)).toBeNull();
    expect(untiePeek).toHaveBeenCalledTimes(1);
    expect(untie).toHaveBeenCalledTimes(1);
    expect(untiePeek.mock.invocationCallOrder[0]).toBeLessThan(untie.mock.invocationCallOrder[0]);
  });

  it('unwires and stops watching the DOM when leaving the screen', async () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe');
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    try {
      const s = mountScreen(own);
      s.vm.tabs = TABS;
      await flushPromises();
      const watcher = observe.mock.contexts.find((context) => context instanceof MutationObserver);
      expect(watcher, 'the layout watches its page for a strip arriving late').toBeDefined();

      s.unmount();
      screen = null;
      expect(untie).toHaveBeenCalledTimes(1);
      expect(untiePeek).toHaveBeenCalledTimes(1);
      expect(disconnect.mock.contexts).toContain(watcher);
    } finally {
      observe.mockRestore();
      disconnect.mockRestore();
    }
  });
});
