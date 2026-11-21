import { describe, expect, it } from 'vitest';

import { resolveIcon } from '../../shell/icons';
import { floorTable, held, seated } from './__tests__/tables';
import { FLOOR_STAT_ICONS, FLOOR_STATUS_ICONS, occupiedAmount, zoneColor } from './model';

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
    const bill = { amount: '42,50 €' };
    expect(occupiedAmount(seated(bill))).toBe('42,50 €');
    expect(occupiedAmount(seated({ amount: '0,00 €' }))).toBe('0,00 €');
    expect([floorTable(bill), held(bill), floorTable({ ...bill, status: 'blocked' }), seated()].map(occupiedAmount)).toEqual(['', '', '', '']);
  });
});
