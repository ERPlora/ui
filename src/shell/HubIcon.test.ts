// HubIcon: the ONE icon component (PLAN §16.4). `<HubIcon name="ion:cart-outline" />`,
// `name="lucide:panel-left"`, `name="mdi:cart"`… Every set paints through `ion-icon`, so its box
// (1em, currentColor), `color` and `slot="start|end|icon-only"` are exactly Ionic's.
// Accessibility (audit R-03, WCAG 1.1.1): an icon is decorative unless it is given a `label`, so a
// screen reader never announces a bare «image» next to the text that already says what it is.
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

  it('IS the ion-icon: slot, color and other attributes reach it as on a plain ion-icon', () => {
    const wrapper = mount(HubIcon, {
      props: { name: 'mdi:cart' },
      attrs: { slot: 'start', color: 'primary', title: 'Cart' },
    });
    expect(wrapper.element.tagName).toBe('ION-ICON');
    expect(wrapper.attributes('slot')).toBe('start');
    expect(wrapper.attributes('title')).toBe('Cart');
    expect(wrapper.getComponent(IonIcon).props('color')).toBe('primary');
  });

  it('without a label it is decorative: hidden from screen readers, with no role and no name', () => {
    for (const name of ['ion:cart-outline', 'mdi:cart']) {
      const wrapper = mount(HubIcon, { props: { name } });
      expect(wrapper.attributes('aria-hidden'), name).toBe('true');
      expect(wrapper.attributes('role'), name).toBeUndefined();
      expect(wrapper.attributes('aria-label'), name).toBeUndefined();
    }
  });

  it('with a label it is an image named by it: role="img" and aria-label, not hidden', () => {
    const wrapper = mount(HubIcon, { props: { name: 'ion:cart-outline', label: 'Cart' } });
    expect(wrapper.attributes('role')).toBe('img');
    expect(wrapper.attributes('aria-label')).toBe('Cart');
    expect(wrapper.attributes('aria-hidden')).toBeUndefined();
  });

  it('decorative wins over a label: hidden, with no role and no name', () => {
    const wrapper = mount(HubIcon, { props: { name: 'ion:cart-outline', label: 'Cart', decorative: true } });
    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.attributes('role')).toBeUndefined();
    expect(wrapper.attributes('aria-label')).toBeUndefined();
  });

  it('a raw aria-label attribute names it like a label, so it is never named and hidden at once', () => {
    const wrapper = mount(HubIcon, { props: { name: 'mdi:cart' }, attrs: { 'aria-label': 'Cart' } });
    expect(wrapper.attributes('role')).toBe('img');
    expect(wrapper.attributes('aria-label')).toBe('Cart');
    expect(wrapper.attributes('aria-hidden')).toBeUndefined();
  });

  it('follows a label that comes and goes', async () => {
    const wrapper = mount(HubIcon, { props: { name: 'ion:cart-outline', label: 'Cart' } });
    await wrapper.setProps({ label: undefined });
    expect(wrapper.attributes('aria-hidden')).toBe('true');
    expect(wrapper.attributes('aria-label')).toBeUndefined();
    await wrapper.setProps({ label: 'Basket' });
    expect(wrapper.attributes('aria-label')).toBe('Basket');
    expect(wrapper.attributes('aria-hidden')).toBeUndefined();
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
