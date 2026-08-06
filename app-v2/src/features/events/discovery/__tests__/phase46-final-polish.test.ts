import { describe, expect, it } from 'vitest';

import {
  isInternalEntityId,
  isInternalPublicEvent,
} from '@/features/events/discovery/internal-event-eligibility';
import type { Event } from '@/features/events/types/event';
import {
  resolveOrganizerVerificationStatus,
  resolveVenueVerificationStatus,
} from '@/features/profiles/utils/entity-verification-status';

describe('Phase 4.6 final polish internal eligibility', () => {
  it('flags staging and demo entity ids', () => {
    expect(isInternalEntityId('staging-seed-artist-charlotte')).toBe(true);
    expect(isInternalEntityId('charlotte-de-witte')).toBe(true);
    expect(isInternalEntityId('venue-bootshaus')).toBe(false);
  });

  it('blocks internal events from public detail surfaces', () => {
    const internal: Pick<Event, 'id' | 'source' | 'sourceEventId'> = {
      id: 'staging-seed-event-tomorrow-techno',
      source: 'staging-seed',
      sourceEventId: 'staging-seed-1',
    };
    expect(isInternalPublicEvent(internal)).toBe(true);
  });
});

describe('entity verification labels', () => {
  it('marks imported production venues as official source', () => {
    expect(resolveVenueVerificationStatus('venue-bootshaus')).toBe('official_source');
    expect(resolveOrganizerVerificationStatus('org-lehmann')).toBe('official_source');
  });

  it('uses profile_not_claimed for unknown entities', () => {
    expect(resolveVenueVerificationStatus('venue-unknown-club')).toBe('profile_not_claimed');
  });
});
