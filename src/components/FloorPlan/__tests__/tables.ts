// Tables as a page hands them to the floor plan's components, with their texts already written.
import type { FloorTable } from '../model';

export function floorTable(overrides: Partial<FloorTable> = {}): FloorTable {
  return {
    id: 't1',
    number: '4',
    status: 'available',
    shape: 'square',
    capacity: 4,
    guests: null,
    ratio: 1,
    tone: 'normal',
    progress: 0,
    short: 'Available',
    statusLabel: 'Available',
    caption: '4 pax',
    pax: '4 pax',
    holder: '',
    holdTime: '',
    timed: false,
    accessible: 'Table 4 · Dining room · 4 pax · Available',
    ...overrides,
  };
}

/** Occupied for 35 minutes by three guests. */
export function seated(overrides: Partial<FloorTable> = {}): FloorTable {
  return floorTable({
    status: 'occupied',
    guests: 3,
    progress: 38.9,
    short: '0:35',
    statusLabel: 'Occupied',
    caption: 'Occupied · 3/4 pax',
    pax: '3/4 pax',
    timed: true,
    accessible: 'Table 4 · Dining room · 4 pax · Occupied · 3 guests · 35 min · Served by Luis',
    ...overrides,
  });
}

/** Reserved for Maximiliana Fernández from 20:00. */
export function held(overrides: Partial<FloorTable> = {}): FloorTable {
  return floorTable({
    status: 'reserved',
    short: '20:00',
    statusLabel: 'Reserved',
    caption: 'Reserved · 4 pax',
    holder: 'Maximiliana Fernández',
    holdTime: '20:00',
    accessible: 'Table 4 · Dining room · 4 pax · Reserved · Reserved for Maximiliana Fernández · 20:00',
    ...overrides,
  });
}
