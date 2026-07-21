import { describe, expect, it } from 'vitest';

import type { AdminEventRecord, VenueRecord } from '@/data/types/records';
import { resolveEventVenueDisplay } from '@/features/create/utils/event-venue-display';

const venues: VenueRecord[] = [
  {
    id: 'venue-1',
    slug: 'gewoelbe',
    name: 'Gewölbe',
    city: 'Köln',
    country: 'Germany',
    address: 'Street 1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('resolveEventVenueDisplay', () => {
  it('uses the linked venue name when venueId is set', () => {
    const record: Pick<AdminEventRecord, 'venueId' | 'venueName' | 'venueCity' | 'subtitle'> = {
      venueId: 'venue-1',
    };

    expect(resolveEventVenueDisplay(record, venues)).toEqual({
      label: 'Gewölbe',
      isSuggestion: false,
    });
  });

  it('shows structured venue suggestions', () => {
    const record: Pick<AdminEventRecord, 'venueId' | 'venueName' | 'venueCity' | 'subtitle'> = {
      venueName: 'Secret Warehouse',
      venueCity: 'Köln',
    };

    expect(resolveEventVenueDisplay(record, venues)).toEqual({
      label: 'Secret Warehouse, Köln',
      isSuggestion: true,
    });
  });

  it('falls back to legacy subtitle reads only', () => {
    const record: Pick<AdminEventRecord, 'venueId' | 'venueName' | 'venueCity' | 'subtitle'> = {
      subtitle: 'Legacy Club',
    };

    expect(resolveEventVenueDisplay(record, venues)).toEqual({
      label: 'Legacy Club',
      isSuggestion: true,
    });
  });
});
