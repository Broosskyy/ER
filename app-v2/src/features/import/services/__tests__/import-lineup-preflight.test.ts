import { describe, expect, it } from 'vitest';

import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  classifyImportLineupPreflight,
  importLineupPreflightIsWritable,
} from '@/features/import/services/import-lineup-preflight';

function entry(
  order: number,
  artists: string[],
): ResolvedCanonicalLineupEntry {
  return {
    order,
    artists,
    artistIds: artists.map((_, index) => `a-${order}-${index}`),
    billingRelation: 'SOLO',
    confidence: 0.5,
    provenance: { source: 'event_artists_backfill' },
  };
}

describe('import-lineup-preflight', () => {
  it('flags empty manifest snapshot with divergent live billing as needs_persistence_write', () => {
    const state = classifyImportLineupPreflight({
      manifestBeforeNames: [],
      goldenTargetNames: ['LUCA DANTE SPADAFORA', '2 ENGEL & CHARLIE'],
      currentStructuredEntries: [entry(0, ['LUCA DANTE SPADAFORA']), entry(1, ['2 ENGEL']), entry(2, ['CHARLIE'])],
    });
    expect(state).toBe('needs_persistence_write');
    expect(importLineupPreflightIsWritable(state)).toBe(true);
  });

  it('returns already_after when live billing matches golden target', () => {
    const state = classifyImportLineupPreflight({
      manifestBeforeNames: [],
      goldenTargetNames: ['2 ENGEL & CHARLIE'],
      currentStructuredEntries: [entry(0, ['2 ENGEL & CHARLIE'])],
    });
    expect(state).toBe('already_after');
  });
});
