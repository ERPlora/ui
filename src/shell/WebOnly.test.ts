// `<WebOnly>`: what sells (the Store, prices, «Change plan», «Pay») is rendered on the web only; on
// the app surfaces it is not even in the DOM, and the `#app` slot says, without a link, how to do it
// from a browser (PLAN-SAAS §3.6, point 5; mockups README §4).
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vitest';

import { applySurface } from './surface';
import WebOnly from './WebOnly.vue';

afterEach(() => applySurface('web'));

function mountWebOnly(slots: Record<string, string>) {
  return mount(WebOnly, { slots });
}

describe('WebOnly', () => {
  it('renders its content on the web', () => {
    const wrapper = mountWebOnly({ default: '<a class="buy" href="/store">Change plan</a>' });
    expect(wrapper.find('a.buy').exists()).toBe(true);
  });

  it('does not render it at all on any app surface (not hidden: absent)', () => {
    for (const surface of ['desktop', 'mobile', 'account'] as const) {
      applySurface(surface);
      const wrapper = mountWebOnly({ default: '<a class="buy" href="/store">Change plan</a>' });
      expect(wrapper.find('a.buy').exists(), surface).toBe(false);
      expect(wrapper.html(), surface).not.toContain('/store');
    }
  });

  it('renders the #app slot instead on the app surfaces, and never on the web', () => {
    const slots = {
      default: '<a class="buy" href="/store">Change plan</a>',
      app: '<p class="how">To change your plan, go to erplora.com in your browser.</p>',
    };
    expect(mountWebOnly(slots).find('p.how').exists()).toBe(false);
    applySurface('mobile');
    const wrapper = mountWebOnly(slots);
    expect(wrapper.get('p.how').text()).toContain('erplora.com');
    expect(wrapper.find('a').exists()).toBe(false);
  });

  it('follows the surface live (a late bridge turns the web into the app)', async () => {
    const wrapper = mountWebOnly({ default: '<a class="buy">Buy</a>', app: '<p class="how">Not here</p>' });
    applySurface('desktop');
    await nextTick();
    expect(wrapper.find('a.buy').exists()).toBe(false);
    expect(wrapper.find('p.how').exists()).toBe(true);
  });

  it('renders nothing on the app surfaces when there is no #app slot', () => {
    applySurface('account');
    expect(mountWebOnly({ default: '<a class="buy">Buy</a>' }).text()).toBe('');
  });
});
