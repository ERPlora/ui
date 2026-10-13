// HubIcon: the ONE icon component (PLAN §16.4). `<HubIcon name="ion:cart-outline" />`,
// `name="lucide:panel-left"`, `name="mdi:cart"`… Every set paints through `ion-icon`, so its box
// (1em, currentColor), `color` and `slot="start|end|icon-only"` are exactly Ionic's.
import { IonIcon } from '@ionic/vue';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import HubIcon from './HubIcon.vue';
import { resolveIcon } from './icons';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('HubIcon', () => {
  it('paints an ion: icon through ion-icon by its Ionicons name (the addIcons registry)', () => {
    const icon = mount(HubIcon, { props: { name: 'ion:cart-outline' } }).getComponent(IonIcon);
    expect(icon.props('name')).toBe('cart-outline');
    expect(icon.props('icon')).toBeUndefined();
  });

  it('paints any other set through ion-icon with its SVG baked at build time', () => {
    for (const name of ['lucide:panel-left', 'mdi:cart', 'material-symbols:point-of-sale']) {
      const icon = mount(HubIcon, { props: { name } }).getComponent(IonIcon);
      expect(icon.props('icon'), name).toBe(resolveIcon(name));
      expect(icon.props('icon'), name).toMatch(/^data:image\/svg\+xml;utf8,<svg /);
      expect(icon.props('name'), name).toBeUndefined();
    }
  });

  it('IS the ion-icon: slot, color and aria attributes reach it as on a plain ion-icon', () => {
    const wrapper = mount(HubIcon, {
      props: { name: 'mdi:cart' },
      attrs: { slot: 'start', color: 'primary', 'aria-label': 'Cart' },
    });
    expect(wrapper.element.tagName).toBe('ION-ICON');
    expect(wrapper.attributes('slot')).toBe('start');
    expect(wrapper.attributes('aria-label')).toBe('Cart');
    expect(wrapper.getComponent(IonIcon).props('color')).toBe('primary');
  });

  it('follows a name that changes', async () => {
    const wrapper = mount(HubIcon, { props: { name: 'ion:sunny-outline' } });
    await wrapper.setProps({ name: 'ion:moon-outline' });
    expect(wrapper.getComponent(IonIcon).props('name')).toBe('moon-outline');
  });

  it('fails loudly in dev and tests on an unregistered icon or a name without its set', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (const name of ['ion:no-such-icon', 'lucide:no-such-icon', 'nope:cart', 'cart-outline', '']) {
      expect(() => mount(HubIcon, { props: { name } }), name).toThrow(/HubIcon: unknown icon/);
    }
  });

  it('in production it reports the unknown icon and paints an empty ion-icon instead of breaking the page', () => {
    vi.stubEnv('DEV', false);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const icon = mount(HubIcon, { props: { name: 'mdi:no-such-icon' } }).getComponent(IonIcon);
    expect(icon.props('name')).toBeUndefined();
    expect(icon.props('icon')).toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('HubIcon: unknown icon "mdi:no-such-icon"'));
  });
});
