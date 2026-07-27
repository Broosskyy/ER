import { describe, expect, it } from 'vitest';

import type { EventDisplayModel } from '@/features/events/formatting/display-event';
import {
  buildDiscoveryGridRows,
  DISCOVERY_GRID_PAGE_SIZE,
  getNextDiscoveryPageCount,
} from '@/features/search/utils/discovery-grid-layout';

function createEvent(id: string): EventDisplayModel {
  return {
    id,
    slug: id,
    title: `Event ${id}`,
    description: '',
    image: 0,
    date: '24 MAI',
    startTime: '23:00',
    venue: 'Bootshaus',
    city: 'Köln',
    genres: ['Techno'],
    artists: [],
    source: 'demo',
    sourceLabel: 'Demo',
    startsAt: '2026-05-24T23:00:00',
    startDateTime: '2026-05-24T23:00:00',
    timezone: 'Europe/Berlin',
    status: 'published',
  };
}

describe('discovery grid layout', () => {
  const events = Array.from({ length: 12 }, (_, index) => createEvent(`event-${index}`));

  it('builds deterministic rows with a featured wide opener', () => {
    const rows = buildDiscoveryGridRows(events, 3);
    expect(rows[0]?.type).toBe('featured-wide');
    expect(rows[0]?.tiles).toHaveLength(2);
    expect(rows[0]?.tiles[0]?.variant).toBe('wide');
  });

  it('fills remaining events in standard triple rows', () => {
    const rows = buildDiscoveryGridRows(events, 3);
    const standardTiles = rows
      .flatMap((row) => row.tiles)
      .filter((tile) => tile.variant === 'standard');
    expect(standardTiles.length).toBeGreaterThan(0);
  });

  it('paginates discovery batches without duplicates', () => {
    const next = getNextDiscoveryPageCount(DISCOVERY_GRID_PAGE_SIZE, 40);
    expect(next).toBe(DISCOVERY_GRID_PAGE_SIZE * 2);
  });
});
