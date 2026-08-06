import { describe, expect, it } from 'vitest';

import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import type { ImportRecord } from '@/features/import/models/types';

function recordWithCandidate(candidate: Record<string, unknown>): ImportRecord {
  return {
    id: 'import-1',
    sourceId: 'source-ticket-io-test',
    status: 'pending',
    matchedArtistIds: [],
    normalizedPayload: candidate,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as ImportRecord;
}

describe('import lineup from record', () => {
  it('prefers lineupEntries over title-only artistNames', () => {
    const record = recordWithCandidate({
      title: 'DNB CONNECTION pres. SHOCKONE',
      artistNames: ['SHOCKONE'],
      sourceMetadata: {
        lineupEntries: [
          { displayName: 'SHOCKONE', source: 'json_ld', confidence: 0.9 },
          { displayName: 'JUNO', source: 'html_lineup', confidence: 0.95 },
          { displayName: 'PALMA', source: 'html_lineup', confidence: 0.95 },
        ],
      },
    });

    const result = extractPrioritizedArtistNames(record);
    expect(result.names).toEqual(expect.arrayContaining(['SHOCKONE', 'JUNO', 'PALMA']));
    expect(result.names.length).toBe(3);
    expect(result.source).toBe('structured');
    expect(result.completeness).toBe('full');
  });

  it('marks single title-derived artist as partial', () => {
    const record = recordWithCandidate({
      title: 'DNB CONNECTION pres. SHOCKONE',
      artistNames: ['SHOCKONE'],
    });

    const result = extractPrioritizedArtistNames(record);
    expect(result.names).toEqual(['SHOCKONE']);
    expect(result.completeness).toBe('partial');
    expect(result.source).toBe('title_inference');
  });

  it('filters placeholder section labels from artistNames', () => {
    const record = recordWithCandidate({
      title: 'Sommerfest',
      artistNames: ['Organization', 'LEVI', 'Line-up', 'MOIA'],
    });

    const result = extractPrioritizedArtistNames(record);
    expect(result.names).toEqual(['LEVI', 'MOIA']);
  });
});
