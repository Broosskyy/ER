import { describe, expect, it } from 'vitest';

import { unionLineupEvidence } from '@/features/aggregation/domain/lineup-evidence-union';

describe('lineup evidence union', () => {
  it('merges duplicates and keeps stronger source ordering', () => {
    const merged = unionLineupEvidence([
      {
        source: 'title',
        entries: [
          { displayName: 'SHOCKONE', normalizedName: 'shockone', source: 'title', confidence: 0.4, sortOrder: 1 },
        ],
      },
      {
        source: 'structured_import',
        entries: [
          { displayName: 'SHOCKONE', normalizedName: 'shockone', source: 'structured_import', confidence: 0.95, sortOrder: 0 },
          { displayName: 'JUNO', normalizedName: 'juno', source: 'structured_import', confidence: 0.9, sortOrder: 1 },
        ],
      },
    ]);
    expect(merged.map((e) => e.displayName)).toEqual(['SHOCKONE', 'JUNO']);
    expect(merged[0]?.source).toBe('structured_import');
  });

  it('does not remove valid artists from weaker flyer source', () => {
    const merged = unionLineupEvidence([
      {
        source: 'structured_import',
        entries: [
          { displayName: 'A', normalizedName: 'a', source: 'structured_import', confidence: 0.9, sortOrder: 0 },
        ],
      },
      {
        source: 'flyer',
        entries: [
          { displayName: 'B', normalizedName: 'b', source: 'flyer', confidence: 0.8, sortOrder: 1 },
        ],
      },
    ]);
    expect(merged).toHaveLength(2);
  });
});
