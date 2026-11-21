// Every text arrives in the person's language: the components only lay it out.

export type FloorTableStatus = 'available' | 'occupied' | 'reserved' | 'blocked';
export type FloorTableShape = 'square' | 'round' | 'rectangle';
export type FloorTimerTone = 'normal' | 'warning' | 'critical';

/** What `TableGlyph` draws: a seat per place, filled by the guests, and the arc of the time occupied. */
export interface FloorGlyphTable {
  status: FloorTableStatus;
  shape: FloorTableShape;
  capacity: number;
  guests: number | null;
  /** Width over height of the table as painted: how its seats share the sides. */
  ratio: number;
  tone: FloorTimerTone;
  /** How far the time occupied has gone towards the critical one, 0–100. */
  progress: number;
}

export interface FloorTable extends FloorGlyphTable {
  id: string;
  number: string;
  /** Inside the table: the time occupied, the hour of its reservation or its status. */
  short: string;
  /** The status in words. */
  statusLabel: string;
  /** Under the table on the plan: the status with the seats, or the seats alone when `short` says the status. */
  caption: string;
  /** The places, or the guests over the places. */
  pax: string;
  /** The bill of an occupied table in the business's currency, written with `formatMoney`; unset without one. */
  amount?: string;
  /** Who holds its reservation and from what hour; empty without one. */
  holder: string;
  holdTime: string;
  /** It has been occupied for a measured time, and `short` says it. */
  timed: boolean;
  /** Everything above in one sentence, for a screen reader. */
  accessible: string;
  /** While a destination is picked: `true` may be picked, `false` is dimmed; unset when nothing is picked. */
  pickable?: boolean;
  testid?: string;
}

/** Where a table is painted on the plan, in pixels; `slot` is the width of the place it owns, its label's limit. */
export interface FloorBox {
  x: number;
  y: number;
  width: number;
  height: number;
  slot: number;
}

export interface FloorZoneTab {
  id: string;
  name: string;
  /** An Ionic colour name (`primary`, `tertiary`…). */
  color: string;
  occupied: number;
  total: number;
  /** `occupied` of `total` in words, for a screen reader. */
  said: string;
  testid?: string;
}

export type FloorStatKey = 'available' | 'occupied' | 'reserved' | 'guests';

export interface FloorStat {
  key: FloorStatKey;
  value: number;
  label: string;
}

export const FLOOR_STATUS_ICONS: Readonly<Record<FloorTableStatus, string>> = Object.freeze({
  available: 'ion:checkmark-circle-outline',
  occupied: 'ion:people-outline',
  reserved: 'ion:time-outline',
  blocked: 'ion:ban-outline',
});

export const FLOOR_STAT_ICONS: Readonly<Record<FloorStatKey, string>> = Object.freeze({
  available: 'ion:checkmark-circle-outline',
  occupied: 'ion:people-outline',
  reserved: 'ion:time-outline',
  guests: 'ion:person-outline',
});

/** What an occupied table shows as its bill; any other table shows none, whatever it carries. */
export function occupiedAmount(table: Pick<FloorTable, 'status' | 'amount'>): string {
  return table.status === 'occupied' ? (table.amount ?? '') : '';
}

export function zoneColor(color: string | null | undefined): string {
  return `var(--ion-color-${color || 'primary'})`;
}
