// Behaviour spec of UserAvatar: the round avatar of a person in the SaaS panel (mockups
// `mockups/saas-panel/`: the sidebar header of every screen, the account profile, member rows).
// Initials on a tone of a small palette, or the person's photo when it loads; an image named after
// the person for a screen reader, or decoration when the name is printed next to it.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import * as root from '../../index';
import { createShellI18n } from '../../shell/i18n';
import { componentCss, declaration } from '../__tests__/themeContrast';
import * as components from '../index';
import { avatarTone } from './avatar';
import * as entry from './index';
import UserAvatar from './UserAvatar.vue';

const SFC = join(dirname(fileURLToPath(import.meta.url)), 'UserAvatar.vue');

type Props = InstanceType<typeof UserAvatar>['$props'];

const mountAvatar = (props: Props, options: { locale?: string; attrs?: Record<string, string> } = {}) =>
  mount(UserAvatar, {
    props,
    attrs: options.attrs,
    global: { plugins: options.locale ? [createShellI18n({ locale: options.locale })] : [] },
  });

afterEach(() => {
  document.documentElement.lang = '';
});

describe('UserAvatar', () => {
  it('paints the initials in a round image named after the person, medium-sized, on the tone of their name', () => {
    const wrapper = mountAvatar({ name: 'Laura Martín' });
    const avatar = wrapper.get('.user-avatar');
    expect(avatar.element).toBe(wrapper.element);
    expect(avatar.text()).toBe('LM');
    expect(avatar.attributes('role')).toBe('img');
    expect(avatar.attributes('aria-label')).toBe('Laura Martín');
    expect(avatar.attributes('data-size')).toBe('md');
    expect(avatar.attributes('data-tone')).toBe(avatarTone('Laura Martín'));
    expect(wrapper.find('img').exists()).toBe(false);
  });

  it('a tone given by the page wins over the one of the name', () => {
    const tone = avatarTone('Laura Martín') === 'violet' ? 'amber' : 'violet';
    expect(mountAvatar({ name: 'Laura Martín', tone }).attributes('data-tone')).toBe(tone);
  });

  it.each([
    ['sm', '24px'],
    ['md', '32px'],
    ['lg', '40px'],
  ] as const)('size %s is %s across', (size, px) => {
    expect(mountAvatar({ name: 'Ana', size }).attributes('data-size')).toBe(size);
    const css = componentCss(SFC);
    expect(declaration(css, `.user-avatar[data-size='${size}']`, '--user-avatar-size')).toBe(px);
  });

  it('the box is as wide as tall, from its size, and round', () => {
    const css = componentCss(SFC);
    expect(declaration(css, '.user-avatar', 'width')).toBe('var(--user-avatar-size)');
    expect(declaration(css, '.user-avatar', 'height')).toBe('var(--user-avatar-size)');
    expect(declaration(css, '.user-avatar', 'border-radius')).toBe('50%');
  });

  it('without a name, takes the initial, the name for a screen reader and the tone from the email', () => {
    const avatar = mountAvatar({ name: '', email: 'laura@panaderialopez.es' });
    expect(avatar.text()).toBe('L');
    expect(avatar.attributes('aria-label')).toBe('laura@panaderialopez.es');
    expect(avatar.attributes('data-tone')).toBe(avatarTone('laura@panaderialopez.es'));
  });

  it('with nothing at all, «?» named «Unknown user» in the person’s language', () => {
    const en = mountAvatar({ name: '' }, { locale: 'en' });
    expect(en.text()).toBe('?');
    expect(en.attributes('aria-label')).toBe('Unknown user');
    expect(mountAvatar({ name: ' ' }, { locale: 'es' }).attributes('aria-label')).toBe('Usuario desconocido');
  });

  it('without vue-i18n, names the unknown person in the language of the page', () => {
    document.documentElement.lang = 'es-ES';
    expect(mountAvatar({ name: '' }).attributes('aria-label')).toBe('Usuario desconocido');
  });

  describe('photo', () => {
    it('shows the photo over the initials once it loads; the image itself is unnamed (the avatar is the image)', async () => {
      const wrapper = mountAvatar({ name: 'Laura Martín', src: '/media/laura.jpg' });
      const img = wrapper.get('img');
      expect(img.attributes('src')).toBe('/media/laura.jpg');
      expect(img.attributes('alt')).toBe('');
      expect(wrapper.get('.user-avatar__initials').text()).toBe('LM');
      await img.trigger('load');
      expect(wrapper.find('.user-avatar__initials').exists()).toBe(false);
      expect(wrapper.get('img').classes()).toContain('user-avatar__img');
      expect(wrapper.attributes('aria-label')).toBe('Laura Martín');
    });

    it('a photo that fails to load leaves the initials', async () => {
      const wrapper = mountAvatar({ name: 'Laura Martín', src: '/media/gone.jpg' });
      await wrapper.get('img').trigger('error');
      expect(wrapper.find('img').exists()).toBe(false);
      expect(wrapper.get('.user-avatar__initials').text()).toBe('LM');
    });

    it('a new photo is tried again after one failed', async () => {
      const wrapper = mountAvatar({ name: 'Laura Martín', src: '/media/gone.jpg' });
      await wrapper.get('img').trigger('error');
      await wrapper.setProps({ src: '/media/new.jpg' });
      expect(wrapper.get('img').attributes('src')).toBe('/media/new.jpg');
    });

    it('a new photo shows the initials again until it loads', async () => {
      const wrapper = mountAvatar({ name: 'Laura Martín', src: '/media/a.jpg' });
      await wrapper.get('img').trigger('load');
      await wrapper.setProps({ src: '/media/b.jpg' });
      expect(wrapper.get('.user-avatar__initials').text()).toBe('LM');
    });

    it('no photo without a source (null or empty)', () => {
      expect(mountAvatar({ name: 'Ana', src: null }).find('img').exists()).toBe(false);
      expect(mountAvatar({ name: 'Ana', src: '' }).find('img').exists()).toBe(false);
    });
  });

  it('is decoration when the page prints the name next to it (the sidebar header): hidden, unnamed', () => {
    const avatar = mountAvatar({ name: 'Laura Martín', decorative: true });
    expect(avatar.text()).toBe('LM');
    expect(avatar.attributes('aria-hidden')).toBe('true');
    expect(avatar.attributes('role')).toBeUndefined();
    expect(avatar.attributes('aria-label')).toBeUndefined();
  });

  it('passes attributes through (a test hook, a title)', () => {
    const avatar = mountAvatar({ name: 'Ana' }, { attrs: { 'data-testid': 'member-avatar', title: 'Ana' } });
    expect(avatar.attributes('data-testid')).toBe('member-avatar');
    expect(avatar.attributes('title')).toBe('Ana');
  });

  it('is our own component, without OutfitKit', () => {
    expect(componentCss(SFC)).not.toMatch(/--ok-|ok-[a-z]/);
  });

  it('is exported from its folder, from `@erplora/ui/components` and from the package root', () => {
    expect(entry.UserAvatar).toBe(UserAvatar);
    expect((components as Record<string, unknown>).UserAvatar).toBe(UserAvatar);
    expect((root as Record<string, unknown>).UserAvatar).toBe(UserAvatar);
    for (const name of ['avatarInitials', 'avatarTone']) {
      expect(typeof (components as Record<string, unknown>)[name], name).toBe('function');
    }
    expect((components as Record<string, unknown>).USER_AVATAR_TONES).toEqual(['brand', 'green', 'violet', 'amber']);
  });
});
