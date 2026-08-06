import { describe, expect, it } from 'vitest';

import { extractPrioritizedLineupEntries } from '@/features/import/services/import-structured-lineup-from-record';
import type { ImportRecord } from '@/features/import/models/types';

function recordWithArtistNames(names: string[]): ImportRecord {
  return {
    id: 'imp-test',
    sourceId: 'source-test',
    externalId: 'ext-1',
    status: 'published',
    normalizedPayload: {
      title: 'MDMA',
      artistNames: names,
    },
    rawPayload: {},
    matchedArtistIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ImportRecord;
}

describe('extractPrioritizedLineupEntries billing preservation', () => {
  it('preserves F2F and B2B from artistNames without flattening to solo entries', () => {
    const result = extractPrioritizedLineupEntries(
      recordWithArtistNames([
        'DYSTOPIA F2F VALKYRIE',
        'FLASH B2B FORWARD',
        'PLEA5URE B2B PUL5E',
      ]),
    );

    expect(result.entries).toHaveLength(3);
    expect(result.entries.map((e) => ({ billing: e.billingRelation, artists: e.artists }))).toEqual([
      { billing: 'F2F', artists: ['DYSTOPIA', 'VALKYRIE'] },
      { billing: 'B2B', artists: ['FLASH', 'FORWARD'] },
      { billing: 'B2B', artists: ['PLEA5URE', 'PUL5E'] },
    ]);
  });
});
