import { describe, expect, it } from 'vitest';

import { createTestMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { organizerMatchingService } from '@/features/import/matching/organizer-matching-service';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

const candidate = (overrides: Partial<NormalizedEventCandidate> = {}): NormalizedEventCandidate => ({
  externalId: 'ext-1',
  title: 'Night Event',
  startDate: '2026-08-15T20:00:00.000Z',
  rawSourceType: 'json_ld',
  ...overrides,
});

describe('organizer matching', () => {
  it('matches exact organizer names', () => {
    const result = organizerMatchingService.match(
      candidate({ organizerName: 'Rave Rebels' }),
      createTestMatchingCatalog(),
    );
    expect(result.matchType).toBe('matched');
    expect(result.organizerId).toBe('organizer-1');
  });

  it('leaves generic organizer names unmatched', () => {
    const result = organizerMatchingService.match(
      candidate({ organizerName: 'TBA' }),
      createTestMatchingCatalog(),
    );
    expect(result.matchType).toBe('invalid');
  });

  it('preserves unmatched organizer text', () => {
    const result = organizerMatchingService.match(
      candidate({ organizerName: 'Unknown Collective' }),
      createTestMatchingCatalog(),
    );
    expect(result.matchType).toBe('unmatched');
    expect(result.organizerId).toBeUndefined();
  });
});
