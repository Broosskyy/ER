import { describe, expect, it } from 'vitest';

import { buildLineupBillingRows } from '@/features/event-detail/utils/lineup-billing-display';

describe('lineup billing display', () => {
  it('builds B2B and F2F billing rows from structured entries', () => {
    const rows = buildLineupBillingRows({
      lineupEntries: [
        { order: 0, billingRelation: 'F2F', artists: ['KARAMUSTAN', 'GREEKZ'] },
        { order: 1, billingRelation: 'B2B', artists: ['BRANDON', 'SAM COLLINS'] },
        { order: 2, billingRelation: 'SOLO', artists: ['LEVI'] },
      ],
      knownArtistNames: ['KARAMUSTAN', 'GREEKZ', 'BRANDON', 'SAM COLLINS', 'LEVI'],
      artistIds: ['a1', 'a2', 'a3', 'a4', 'a5'],
    });

    expect(rows).toHaveLength(3);
    expect(rows[0]?.billingRelation).toBe('F2F');
    expect(rows[0]?.accessibilityLabel).toBe('KARAMUSTAN f2f GREEKZ');
    expect(rows[1]?.accessibilityLabel).toBe('BRANDON b2b SAM COLLINS');
    expect(rows[2]?.billingRelation).toBe('SOLO');
  });

  it('preserves artist navigation ids from flat compatibility list', () => {
    const rows = buildLineupBillingRows({
      lineupEntries: [{ order: 0, billingRelation: 'B2B', artists: ['FLASH', 'FORWARD'] }],
      knownArtistNames: ['FLASH', 'FORWARD'],
      artistIds: ['flash-id', 'forward-id'],
    });
    expect(rows[0]?.artists.map((artist) => artist.id)).toEqual(['flash-id', 'forward-id']);
  });
});
