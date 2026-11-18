import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import { componentCss, declaration } from '../../components/__tests__/themeContrast';
import { unnamedButtons, unnamedIcons } from '../../testing/a11y';
import HubIcon from '../HubIcon.vue';
import { createShellI18n } from '../i18n';
import ActionFeatured from './ActionFeatured.vue';
import type { ActionNotice } from './types';

const notice: ActionNotice = {
  id: 'billing.unpaid',
  severity: 'danger',
  icon: 'ion:receipt-outline',
  label: 'Unpaid invoice',
  title: 'An invoice needs paying',
  body: 'Pay it before Friday to keep the hub active.',
  figure: '29.00 €',
  chip: '3 days left',
  due: { at: '2026-11-20T00:00:00Z' },
  action: { label: 'Pay invoice', to: '/billing' },
  secondary: { label: 'Change card', to: '/billing/card' },
};

function mountFeatured(overrides: Partial<ActionNotice> = {}, state = {}) {
  return mount(ActionFeatured, {
    props: { notice: { ...notice, ...overrides }, dueProgress: 0.25, ...state },
    global: { plugins: [createShellI18n({ locale: 'en' })] },
  });
}

describe('ActionFeatured', () => {
  it('gives the key datum, title, consequence and deadline a clear hierarchy', () => {
    const featured = mountFeatured().get('[data-testid="action-featured"]');
    expect(featured.attributes('data-severity')).toBe('danger');
    expect(featured.get('h3').text()).toBe('An invoice needs paying');
    expect(featured.get('.action-featured__figure').text()).toBe('29.00 €');
    expect(featured.get('.action-featured__body').text()).toBe('Pay it before Friday to keep the hub active.');
    expect(featured.get('.action-featured__kicker').text()).toContain('Urgent');
    expect(featured.get('.action-featured__kicker').text()).toContain('3 days left');
    expect((featured.get('.action-featured__ring').element as HTMLElement).style.getPropertyValue('--due-remaining')).toBe('0.75');
    expect(unnamedButtons(featured.element)).toEqual([]);
    expect(unnamedIcons(featured.element)).toEqual([]);
  });

  it('has one full-width primary action and a textual secondary action', async () => {
    const wrapper = mountFeatured();
    const primary = wrapper.get('ion-button.action-featured__primary');
    expect(primary.text()).toBe('Pay invoice');
    expect((primary.element as HTMLElement & { expand?: string }).expand).toBe('block');
    expect(wrapper.findAll('ion-button.action-featured__primary')).toHaveLength(1);
    await primary.trigger('click');
    expect(wrapper.emitted('action')?.[0][0]).toBe('primary');
    const secondary = wrapper.get('ion-button.action-featured__secondary');
    expect((secondary.element as HTMLElement & { fill?: string }).fill).toBe('clear');
    await secondary.trigger('click');
    expect(wrapper.emitted('action')?.[1][0]).toBe('secondary');
  });

  it('spins and disables the primary action while busy, and hides the secondary one', () => {
    const wrapper = mountFeatured({}, { busy: true });
    const primary = wrapper.get('ion-button.action-featured__primary');
    expect((primary.element as HTMLElement & { disabled?: boolean }).disabled).toBe(true);
    expect(primary.find('ion-spinner').exists()).toBe(true);
    expect(primary.text()).toBe('Working…');
    expect(wrapper.find('.action-featured__secondary').exists()).toBe(false);
  });

  // A disabled button fades its label below AA: once solved the actions give way to a check in the success colour.
  it('draws a check in place of its actions once resolved', () => {
    const wrapper = mountFeatured({}, { resolved: true });
    expect(wrapper.get('[data-testid="action-featured"]').attributes('data-resolved')).toBe('true');
    const done = wrapper.get('.action-featured__done');
    expect(done.attributes('role')).toBe('status');
    expect(done.text()).toBe('Resolved');
    expect(done.findComponent(HubIcon).props('name')).toBe('ion:checkmark-outline');
    expect(wrapper.findAll('ion-button')).toHaveLength(0);
    const css = componentCss(`${__dirname}/ActionFeatured.vue`);
    expect(declaration(css, '.action-featured__done', 'color')).toBe('var(--ep-success-text)');
    expect(declaration(css, '.action-featured__done', 'min-height')).toBe('50px');
  });

  it('centres the deadline ring on the key figure, with its clock inside the ring', () => {
    const data = mountFeatured().get('.action-featured__data');
    expect([...data.element.children].map((child) => child.className)).toEqual([
      'action-featured__figure',
      'action-featured__ring',
    ]);
    expect(data.get('.action-featured__ring').findComponent(HubIcon).props('name')).toBe('ion:time-outline');
    const css = componentCss(`${__dirname}/ActionFeatured.vue`);
    expect(declaration(css, '.action-featured__data', 'align-items')).toBe('center');
    expect(declaration(css, '.action-featured__ring', 'position')).toBe('relative');
    expect(declaration(css, '.action-featured__ring', 'place-items')).toBe('center');
    expect(declaration(css, '.action-featured__ring', 'width')).toBe('44px');
    expect(declaration(css, '.action-featured__ring', 'height')).toBe('44px');
    expect(declaration(css, '.action-featured__ring::before', 'position')).toBe('absolute');
    expect(declaration(css, '.action-featured__ring::before', 'inset')).toBe('0');
    expect(declaration(css, '.action-featured__ring::before', 'mask')).toContain('radial-gradient');
  });

  // The phrase carried the room above the button, so a notice without one glued its button to the title.
  it('without a phrase, a figure or a deadline paints none of them and keeps its button apart from the title', () => {
    const wrapper = mountFeatured({ body: undefined, figure: undefined, due: undefined });
    expect(wrapper.find('.action-featured__body').exists()).toBe(false);
    expect(wrapper.find('.action-featured__data').exists()).toBe(false);
    expect(wrapper.get('.action-featured__primary').text()).toContain('Pay invoice');
    const css = componentCss(`${__dirname}/ActionFeatured.vue`);
    expect(declaration(css, '.action-featured__body', 'margin')).toBe('4px 0 0');
    expect(declaration(css, '.action-featured__actions', 'margin-top')).toBe('14px');
    expect(declaration(css, '.action-featured__done', 'margin-top')).toBe('14px');
  });

  it('paints a notice without a primary action with no buttons at all', () => {
    const wrapper = mountFeatured({ action: undefined });
    expect(wrapper.findAll('ion-button')).toHaveLength(0);
  });

  it('omits the ring when the store has no progress for this featured notice', () => {
    const wrapper = mount(ActionFeatured, {
      props: { notice },
      global: { plugins: [createShellI18n({ locale: 'en' })] },
    });
    expect(wrapper.find('.action-featured__ring').exists()).toBe(false);
  });

  it('uses tabular figures and a conic ring, never a loose SVG', () => {
    const css = componentCss(`${__dirname}/ActionFeatured.vue`);
    expect(declaration(css, '.action-featured__figure', 'font-variant-numeric')).toBe('tabular-nums');
    expect(css).toContain('conic-gradient');
    expect(css).toContain('@keyframes action-featured-check');
    expect(wrapperHtml()).not.toContain('<svg');
  });
});

function wrapperHtml(): string {
  return mountFeatured().html();
}
