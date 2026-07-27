import { describe, expect, it } from 'vitest';

import { DiscoveryDiversityService } from '@/features/events/discovery/discovery-diversity-service';
import { DiscoveryRankingService } from '@/features/events/discovery/discovery-ranking-service';
import { isRecentlyAdded } from '@/features/events/status/recently-added-resolver';
import { CanonicalEventIdResolver } from '@/features/events/services/canonical-event-id-resolver';

describe('discovery foundations', () => {
  it('ranks deterministically with canonical ID tie-breaker', () => {
    const ranked = new DiscoveryRankingService().rank([
      { canonicalEventId: 'b', startDateTime: '2026-08-01T20:00:00Z', eventQuality: 50, sourceTrust: 50, freshness: 50, hasImage: false, hasTickets: false },
      { canonicalEventId: 'a', startDateTime: '2026-08-01T20:00:00Z', eventQuality: 50, sourceTrust: 50, freshness: 50, hasImage: false, hasTickets: false },
    ], { surface: 'events_list', timestamp: '2026-07-01T00:00:00Z' });
    expect(ranked.map((entry) => entry.canonicalEventId)).toEqual(['a', 'b']);
  });

  it('does not show a canonical event or duplicate group twice', () => {
    const events = new DiscoveryDiversityService().diversify([
      { canonicalEventId: 'a', duplicateGroupId: 'g', startDateTime: '2026-08-01T20:00:00Z', eventQuality: 80, sourceTrust: 80, freshness: 80, hasImage: true, hasTickets: true, score: 90 },
      { canonicalEventId: 'b', duplicateGroupId: 'g', startDateTime: '2026-08-01T21:00:00Z', eventQuality: 70, sourceTrust: 70, freshness: 70, hasImage: true, hasTickets: true, score: 80 },
      { canonicalEventId: 'a', startDateTime: '2026-08-01T22:00:00Z', eventQuality: 60, sourceTrust: 60, freshness: 60, hasImage: true, hasTickets: true, score: 70 },
    ]);
    expect(events.map((event) => event.canonicalEventId)).toEqual(['a']);
  });

  it('uses publication time rather than import or update timestamps', () => {
    expect(isRecentlyAdded({ publishedAt: '2026-07-20T00:00:00Z' }, new Date('2026-07-26T00:00:00Z'))).toBe(true);
    expect(isRecentlyAdded({}, new Date('2026-07-26T00:00:00Z'))).toBe(false);
  });

  it('resolves aliases and removes merged duplicate IDs without deleting saved references', async () => {
    const resolver = new CanonicalEventIdResolver({
      findCanonicalId: async (id) => id === 'legacy' ? 'canonical' : null,
    });
    expect(await resolver.resolve('legacy')).toBe('canonical');
    expect(await resolver.deduplicate([{ id: 'legacy' }, { id: 'canonical' }])).toEqual([{ id: 'canonical' }]);
  });
});
