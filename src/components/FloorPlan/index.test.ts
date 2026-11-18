import { describe, expect, it } from 'vitest';

import * as components from '../index';
import FloorCard from './FloorCard.vue';
import FloorCards from './FloorCards.vue';
import FloorSkeleton from './FloorSkeleton.vue';
import FloorSummary from './FloorSummary.vue';
import FloorTile from './FloorTile.vue';
import FloorZoneTabs from './FloorZoneTabs.vue';
import TableGlyph from './TableGlyph.vue';
import { useScrollEdges } from './useScrollEdges';

describe('@erplora/ui/components carries the floor plan', () => {
  it('exports its pieces, the status icons and the scroll edges a page’s own plan fades with', () => {
    expect(components).toMatchObject({ FloorCard, FloorCards, FloorSkeleton, FloorSummary, FloorTile, FloorZoneTabs, TableGlyph, useScrollEdges });
    expect(components.FLOOR_STATUS_ICONS.blocked).toBe('ion:ban-outline');
    expect(components.zoneColor('success')).toBe('var(--ion-color-success)');
  });
});
