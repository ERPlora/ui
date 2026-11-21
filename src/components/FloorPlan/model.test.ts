import { describe, expect, it } from 'vitest';

import { resolveIcon } from '../../shell/icons';
import { billless, requested, seated, unrequested } from './__tests__/tables';
import {
  FLOOR_BILL_ICON,
  FLOOR_STAT_ICONS,
  FLOOR_STATUS_ICONS,
  isBillRequested,
  occupiedAmount,
  statusIcon,
  zoneColor,
} from './model';

describe('floor plan model', () => {
  it('gives every status its own registered icon, so a status is never the colour alone', () => {
    expect(Object.keys(FLOOR_STATUS_ICONS).sort()).toEqual(['available', 'blocked', 'occupied', 'reserved']);
    expect(new Set(Object.values(FLOOR_STATUS_ICONS)).size).toBe(4);
    for (const name of Object.values(FLOOR_STATUS_ICONS)) expect(resolveIcon(name), name).toBeDefined();
  });

  it('gives every figure of the summary a registered icon', () => {
    expect(Object.keys(FLOOR_STAT_ICONS).sort()).toEqual(['available', 'guests', 'occupied', 'reserved']);
    for (const name of Object.values(FLOOR_STAT_ICONS)) expect(resolveIcon(name), name).toBeDefined();
  });

  it('paints a zone in its Ionic colour, primary when there is none', () => {
    expect(zoneColor('tertiary')).toBe('var(--ion-color-tertiary)');
    expect(zoneColor(null)).toBe('var(--ion-color-primary)');
    expect(zoneColor('')).toBe('var(--ion-color-primary)');
  });

  it('gives the bill of an occupied table only, and nothing when it did not arrive', () => {
    expect(occupiedAmount(seated({ amount: '42,50 €' }))).toBe('42,50 €');
    expect(occupiedAmount(seated({ amount: '0,00 €' }))).toBe('0,00 €');
    expect(billless().map(occupiedAmount)).toEqual(['', '', '', '', '']);
  });

  it('marks a requested bill on an occupied table only, with a registered icon of its own in place of the status one', () => {
    expect(isBillRequested(requested())).toBe(true);
    expect(unrequested().map(isBillRequested)).toEqual([false, false, false, false, false]);
    expect(statusIcon(requested())).toBe(FLOOR_BILL_ICON);
    expect(unrequested().map(statusIcon)).toEqual(unrequested().map((table) => FLOOR_STATUS_ICONS[table.status]));
    expect(Object.values(FLOOR_STATUS_ICONS)).not.toContain(FLOOR_BILL_ICON);
    expect(resolveIcon(FLOOR_BILL_ICON), FLOOR_BILL_ICON).toBeDefined();
  });
});
