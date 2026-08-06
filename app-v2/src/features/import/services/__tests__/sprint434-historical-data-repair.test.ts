import { describe, expect, it } from 'vitest';

import {
  applyExplicitEventGeographyFields,
  applyExternalLocationAdminVenueFields,
  candidateCanHistoricalRepair,
  eventHasWrongBootshausExternalVenue,
  eventNeedsHistoricalRepair,
  eventNeedsTitleLineupRepair,
  HISTORICAL_DATA_REPAIR_VERSION,
  stampHistoricalRepairMetadata,
} from '@/features/import/services/historical-data-repair';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

function adminEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-1',
    title: '122 pres. ARTIST @ AMØK Club, Palma de Mallorca (ES)',
    description: '',
    startDate: '2026-08-01T22:00:00+02:00',
    sourceId: 'source-bootshaus-koeln',
    venueId: 'venue-bootshaus-koeln',
    venueName: 'Bootshaus',
    venueCity: 'Köln',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('sprint 43.4 historical data repair', () => {
  it('stamps repair metadata with current repair version', () => {
    const metadata = stampHistoricalRepairMetadata({ connectorVersion: '1.0.0' });
    expect(metadata.dataQualityRepairVersion).toBe(HISTORICAL_DATA_REPAIR_VERSION);
    expect(metadata.historicalRepairVersion).toBe(HISTORICAL_DATA_REPAIR_VERSION);
  });

  it('detects wrong Bootshaus external venue mapping', () => {
    expect(eventHasWrongBootshausExternalVenue(adminEvent())).toBe(true);
    expect(
      eventHasWrongBootshausExternalVenue(
        adminEvent({ title: 'PLAY! Open Air', venueId: 'venue-bootshaus-koeln', venueName: 'Bootshaus' }),
      ),
    ).toBe(false);
  });

  it('flags historical repair for Mallorca regression', () => {
    expect(eventNeedsHistoricalRepair(adminEvent())).toBe(true);
  });

  it('flags title lineup repair when artist_id missing', () => {
    expect(
      eventNeedsTitleLineupRepair(
        adminEvent({
          sourceId: 'source-ticket-io-protontheclub',
          title: 'DNB CONNECTION pres. SHOCKONE',
          artistId: undefined,
        }),
      ),
    ).toBe(true);
  });

  it('allows candidate historical repair for external venue correction', () => {
    const candidate = {
      title: '122 pres. ARTIST @ AMØK Club, Palma de Mallorca (ES)',
      venueName: 'AMØK Club',
      cityName: 'Palma de Mallorca',
      sourceMetadata: { externalLocationFromTitle: true },
    } as CanonicalImportEvent;
    expect(candidateCanHistoricalRepair(candidate, adminEvent())).toBe(true);
  });

  it('clears Bootshaus venue link for Palma-only external titles', () => {
    const existing = adminEvent({
      title: '122 pres. MAXI MERAKI @ Palma de Mallorca (ES)',
    });
    const patch = applyExternalLocationAdminVenueFields(existing, {
      title: existing.title,
      cityName: 'Palma de Mallorca',
      venueName: undefined,
      sourceMetadata: { externalLocationFromTitle: true },
    } as CanonicalImportEvent);

    expect(patch.venueCity).toBe('Palma de Mallorca');
    expect(patch.venueId).toBeUndefined();
  });

  it('clears a stale venue link for any explicit event geography', () => {
    const patch = applyExplicitEventGeographyFields(
      adminEvent({
        sourceId: 'source-ticket-io-protontheclub',
        venueId: 'venue-old',
        venueName: 'Old Venue',
        venueCity: 'Köln',
      }),
      {
        title: 'International event',
        venueName: 'New Venue',
        cityName: 'Stuttgart',
        sourceMetadata: {
          eventGeography: { venue: 'explicit', city: 'explicit' },
        },
      } as CanonicalImportEvent,
    );

    expect(patch.venueName).toBe('New Venue');
    expect(patch.venueCity).toBe('Stuttgart');
    expect(patch.venueId).toBeUndefined();
  });
});
