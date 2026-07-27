import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import type { DiscoveryTileVariant } from '@/components/discovery/discovery-tile-styles';

export type DiscoveryGridRowType = 'triple' | 'featured-wide' | 'featured-tall';

export interface DiscoveryGridTileSlot {
  event: EventDisplayModel;
  variant: DiscoveryTileVariant;
  flex: number;
}

export interface DiscoveryGridRow {
  id: string;
  type: DiscoveryGridRowType;
  tiles: DiscoveryGridTileSlot[];
}

const FEATURED_WIDE_CYCLE = 10;
const FEATURED_TALL_CYCLE = 16;

/**
 * Deterministic grid rhythm:
 * - every 10th event starts a wide + standard pair row
 * - every 16th event (non-wide row) starts a tall + 2 standards row
 * - otherwise fill rows of `columns` standard tiles
 */
export function buildDiscoveryGridRows(
  events: readonly EventDisplayModel[],
  columns: number,
): DiscoveryGridRow[] {
  const rows: DiscoveryGridRow[] = [];
  let index = 0;
  let rowCounter = 0;

  while (index < events.length) {
    if (index % FEATURED_WIDE_CYCLE === 0 && index + 1 < events.length && columns >= 3) {
      rows.push({
        id: `row-${rowCounter++}-wide`,
        type: 'featured-wide',
        tiles: [
          { event: events[index]!, variant: 'wide', flex: 2 },
          { event: events[index + 1]!, variant: 'standard', flex: 1 },
        ],
      });
      index += 2;
      continue;
    }

    if (
      index % FEATURED_TALL_CYCLE === 0 &&
      index % FEATURED_WIDE_CYCLE !== 0 &&
      index + 2 < events.length &&
      columns >= 3
    ) {
      rows.push({
        id: `row-${rowCounter++}-tall`,
        type: 'featured-tall',
        tiles: [
          { event: events[index]!, variant: 'tall', flex: 1 },
          { event: events[index + 1]!, variant: 'standard', flex: 1 },
          { event: events[index + 2]!, variant: 'standard', flex: 1 },
        ],
      });
      index += 3;
      continue;
    }

    const chunk = events.slice(index, index + columns);
    rows.push({
      id: `row-${rowCounter++}-triple`,
      type: 'triple',
      tiles: chunk.map((event) => ({
        event,
        variant: 'standard' as const,
        flex: 1,
      })),
    });
    index += chunk.length;
  }

  return rows;
}

export const DISCOVERY_GRID_PAGE_SIZE = 18;

export function paginateDiscoveryEvents<T>(
  events: readonly T[],
  visibleCount: number,
): T[] {
  return events.slice(0, visibleCount);
}

export function getNextDiscoveryPageCount(
  currentCount: number,
  total: number,
  pageSize: number = DISCOVERY_GRID_PAGE_SIZE,
): number {
  return Math.min(currentCount + pageSize, total);
}
