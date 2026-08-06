import { describe, expect, it } from 'vitest';

import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  compareResolvedLineupEntries,
  isLegacyBackfillLineupEntry,
  needsStructuredLineupReplace,
} from '@/features/import/services/structured-lineup-replace-decision';

function entry(
  overrides: Partial<ResolvedCanonicalLineupEntry> & Pick<ResolvedCanonicalLineupEntry, 'artistIds'>,
): ResolvedCanonicalLineupEntry {
  return {
    order: 0,
    artists: [],
    billingRelation: 'SOLO',
    artistIds: overrides.artistIds,
    ...overrides,
  };
}

describe('structured-lineup-replace-decision', () => {
  it('detects legacy backfill entries', () => {
    expect(
      isLegacyBackfillLineupEntry(
        entry({
          artistIds: ['a1'],
          provenance: { source: 'event_artists_backfill' },
        }),
      ),
    ).toBe(true);
    expect(
      isLegacyBackfillLineupEntry(
        entry({
          artistIds: ['a1'],
          confidence: 0.5,
        }),
      ),
    ).toBe(true);
  });

  it('replaces empty structured storage with import entries', () => {
    expect(
      needsStructuredLineupReplace(
        [],
        [
          entry({
            artistIds: ['a1'],
            provenance: { importRecordId: 'imp-1' },
          }),
        ],
      ),
    ).toBe(true);
  });

  it('replaces legacy backfill with import evidence even when flat artist order matches', () => {
    const legacy = [
      entry({
        order: 0,
        artistIds: ['a1'],
        provenance: { source: 'event_artists_backfill' },
        confidence: 0.5,
      }),
    ];
    const incoming = [
      entry({
        order: 0,
        artistIds: ['a1'],
        provenance: { importRecordId: 'imp-1', source: 'structured' },
        confidence: 0.85,
      }),
    ];

    expect(needsStructuredLineupReplace(legacy, incoming)).toBe(true);
    expect(compareResolvedLineupEntries(legacy, incoming)).toBe(true);
  });

  it('replaces 18 solo backfill rows with 9 billing pairs', () => {
    const legacy = Array.from({ length: 18 }, (_, index) =>
      entry({
        order: index,
        artistIds: [`a${index}`],
        provenance: { source: 'event_artists_backfill' },
        confidence: 0.5,
      }),
    );
    const incoming = Array.from({ length: 9 }, (_, index) =>
      entry({
        order: index,
        artistIds: [`a${index * 2}`, `a${index * 2 + 1}`],
        billingRelation: index % 2 === 0 ? 'F2F' : 'B2B',
        provenance: { importRecordId: 'imp-mdma' },
        confidence: 0.9,
      }),
    );

    expect(needsStructuredLineupReplace(legacy, incoming)).toBe(true);
  });

  it('skips when import structure already persisted', () => {
    const persisted = [
      entry({
        order: 0,
        artistIds: ['flash', 'forward'],
        billingRelation: 'B2B',
        provenance: { importRecordId: 'imp-1' },
        confidence: 0.9,
      }),
    ];
    const incoming = [
      entry({
        order: 0,
        artistIds: ['flash', 'forward'],
        billingRelation: 'B2B',
        provenance: { importRecordId: 'imp-1' },
        confidence: 0.9,
      }),
    ];

    expect(needsStructuredLineupReplace(persisted, incoming)).toBe(false);
  });
});
