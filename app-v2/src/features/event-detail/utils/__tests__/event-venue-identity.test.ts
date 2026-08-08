import { describe, expect, it } from 'vitest';

import type { VenueRecord } from '@/data/types/records';
import {
  evaluateEventVenueIdentity,
  eventVenueNamesMatch,
  isStaleInlineVenueAddress,
  resolveTrustedLinkedVenue,
} from '@/features/event-detail/utils/event-venue-identity';

const bootshausVenue: Pick<VenueRecord, 'name'> = { name: 'Bootshaus' };

describe('event-venue-identity', () => {
  it('matches canonical Moxy label against itself', () => {
    expect(eventVenueNamesMatch('Moxy Köln/Bonn Flughafen', 'Moxy Köln/Bonn Flughafen')).toBe(true);
  });

  it('rejects stale Bootshaus venue entity for Moxy event label', () => {
    const evaluation = evaluateEventVenueIdentity({
      canonicalVenueName: 'Moxy Köln/Bonn Flughafen',
      linkedVenue: bootshausVenue,
      inlineAddress: 'Auenweg 173, 51063 Köln',
      organizerName: 'Bootshaus',
    });

    expect(evaluation.linkedVenueTrusted).toBe(false);
    expect(evaluation.reason).toBe('identity_mismatch');
    expect(evaluation.staleInlineAddress).toBe(true);
    expect(resolveTrustedLinkedVenue(evaluation, bootshausVenue as VenueRecord)).toBeNull();
  });

  it('keeps organizer Bootshaus separate from venue identity', () => {
    const evaluation = evaluateEventVenueIdentity({
      canonicalVenueName: 'Moxy Köln/Bonn Flughafen',
      linkedVenue: bootshausVenue,
      inlineAddress: 'Auenweg 173, 51063 Köln',
      organizerName: 'Bootshaus',
    });

    expect(evaluation.reason).not.toBe('organizer_as_venue');
  });

  it('flags Bootshaus street as stale for Moxy canonical label', () => {
    expect(
      isStaleInlineVenueAddress(
        'Moxy Köln/Bonn Flughafen',
        'Auenweg 173, 51063 Köln',
        'Bootshaus',
      ),
    ).toBe(true);
  });

  it('trusts linked venue when names align', () => {
    const evaluation = evaluateEventVenueIdentity({
      canonicalVenueName: 'Bootshaus',
      linkedVenue: bootshausVenue,
      inlineAddress: 'Auenweg 173, 51063 Köln',
      organizerName: 'Bootshaus',
    });

    expect(evaluation.linkedVenueTrusted).toBe(true);
    expect(evaluation.reason).toBe('identity_match');
    expect(evaluation.staleInlineAddress).toBe(false);
  });
});
