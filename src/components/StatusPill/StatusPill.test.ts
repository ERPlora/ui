// Behaviour spec of StatusPill: the status chip of the SaaS panel mockups (`.status-pill .st-*` of
// the old `erplora-admin.css` plus the `st-info` tone and the busy pulse of `mock.css`): a short
// label on a tinted pill with a dot of its own colour, in five tones and two sizes.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import * as root from '../../index';
import * as components from '../index';
import StatusPill from './StatusPill.vue';
import * as entry from './index';

const HERE = dirname(fileURLToPath(import.meta.url));

type Props = InstanceType<typeof StatusPill>['$props'];

const mountPill = (props: Props = { label: 'Active' }, slots: Record<string, () => unknown> = {}) =>
  mount(StatusPill, { props, slots });

describe('StatusPill', () => {
  it('paints the label in a pill, neutral, medium-sized and with its dot by default', () => {
    const wrapper = mountPill();
    const pill = wrapper.get('.status-pill');
    expect(pill.element).toBe(wrapper.element);
    expect(pill.element.tagName).toBe('SPAN');
    expect(pill.text()).toBe('Active');
    expect(pill.attributes('data-tone')).toBe('neutral');
    expect(pill.attributes('data-size')).toBe('md');
    expect(pill.classes()).toContain('status-pill--dot');
    expect(pill.classes()).not.toContain('status-pill--busy');
  });

  it.each(['success', 'info', 'warning', 'danger', 'neutral'] as const)('tone %s is the data-tone of the pill', (tone) => {
    expect(mountPill({ label: 'x', tone }).get('.status-pill').attributes('data-tone')).toBe(tone);
  });

  it('drops the dot with `dot: false`', () => {
    expect(mountPill({ label: 'x', dot: false }).get('.status-pill').classes()).not.toContain('status-pill--dot');
  });

  it('comes in a small size', () => {
    expect(mountPill({ label: 'x', size: 'sm' }).get('.status-pill').attributes('data-size')).toBe('sm');
  });

  it('pulses its dot while busy («Preparing…», «Activating…»)', () => {
    expect(mountPill({ label: 'Preparing', tone: 'info', busy: true }).get('.status-pill').classes()).toContain(
      'status-pill--busy',
    );
  });

  it('the default slot replaces the label (a date inside the status, «Ends on 31 Oct»)', () => {
    const pill = mountPill({ label: 'Cancelled', tone: 'warning' }, { default: () => 'Ends on 31 Oct' });
    expect(pill.text()).toBe('Ends on 31 Oct');
  });

  it('passes attributes through (a test hook, a title)', () => {
    const pill = mount(StatusPill, { props: { label: 'Active' }, attrs: { 'data-testid': 'biz-status', title: 'Since 1 Oct' } });
    expect(pill.attributes('data-testid')).toBe('biz-status');
    expect(pill.attributes('title')).toBe('Since 1 Oct');
  });

  it('the dot is decoration (a pseudo-element, nothing for a screen reader) and the pulse respects reduced motion', () => {
    const sfc = readFileSync(join(HERE, 'StatusPill.vue'), 'utf8');
    expect(sfc).toMatch(/\.status-pill--dot::before\s*\{/);
    expect(sfc).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.status-pill--busy::before/);
    expect(sfc).not.toMatch(/--ok-|ok-[a-z]/);
  });

  it('is exported from its folder, from `@erplora/ui/components` and from the package root', () => {
    expect(entry.StatusPill).toBe(StatusPill);
    expect((components as Record<string, unknown>).StatusPill).toBe(StatusPill);
    expect((root as Record<string, unknown>).StatusPill).toBe(StatusPill);
    expect(typeof (components as Record<string, unknown>).businessStatusPill).toBe('function');
    expect(typeof (components as Record<string, unknown>).invoiceStatusPill).toBe('function');
  });
});
