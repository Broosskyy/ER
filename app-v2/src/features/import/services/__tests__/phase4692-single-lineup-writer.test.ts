import { describe, expect, it, vi } from 'vitest';

import type { ResolvedCanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import {
  buildCompatibilityProjectionFromStructured,
  compatibilityProjectionMatches,
} from '@/features/events/domain/lineup-compatibility-projection';
import { buildLineupFromResolvedEntries } from '@/features/events/domain/structured-lineup-primary';
import {
  syncCompatibilityProjectionFromStructured,
  writeCanonicalStructuredLineup,
} from '@/features/events/services/canonical-structured-lineup-writer';
import { WRITER_PATH_INVENTORY } from '@/features/aggregation/audit/lineup-audit-inventory';
import {
  buildTitleInferenceCandidates,
  canRunTitleInference,
  hasHigherTrustLineupEvidence,
} from '@/features/import/services/title-inference-candidate';
import { writeImportPublishLineup } from '@/features/import/services/import-publish-lineup-writer';
import type { ImportRecord } from '@/features/import/models/types';
import type { EventLineupService } from '@/features/events/services/event-lineup-service';

function soloEntry(artistId: string, order: number): ResolvedCanonicalLineupEntry {
  return {
    order,
    artists: [],
    artistIds: [artistId],
    billingRelation: 'SOLO',
    confidence: 0.9,
  };
}

describe('phase 4692 P1 single structured lineup writer', () => {
  it('has exactly one authoritative structured writer in inventory', () => {
    const authoritative = WRITER_PATH_INVENTORY.filter((writer) => writer.authoritative);
    expect(authoritative).toHaveLength(1);
    expect(authoritative[0]?.id).toBe('canonical_structured_writer');
  });

  it('does not infer headliner billing from SOLO structured entries', () => {
    const projection = buildLineupFromResolvedEntries([
      soloEntry('artist-a', 0),
      soloEntry('artist-b', 1),
    ]);
    expect(projection.every((row) => row.billingRole === 'support')).toBe(true);
  });

  it('preserves explicit special guest billing in compatibility projection', () => {
    const projection = buildCompatibilityProjectionFromStructured([
      {
        order: 0,
        artists: [],
        artistIds: ['guest-1'],
        billingRelation: 'SPECIAL_GUEST',
      },
      soloEntry('artist-a', 1),
    ]);
    expect(projection[0]?.billingRole).toBe('special_guest');
    expect(projection[1]?.billingRole).toBe('support');
  });

  it('excludes legacy artifact artists from compatibility projection', () => {
    const projection = buildCompatibilityProjectionFromStructured(
      [soloEntry('valid-1', 0), soloEntry('legacy-1', 1)],
      {
        artistsById: new Map([
          ['valid-1', { lineupLegacyArtifact: false }],
          ['legacy-1', { lineupLegacyArtifact: true }],
        ]),
      },
    );
    expect(projection.map((row) => row.artistId)).toEqual(['valid-1']);
  });

  it('writeCanonicalStructuredLineup is idempotent on identical input', async () => {
    const entries = [soloEntry('artist-a', 0), soloEntry('artist-b', 1)];
    const replaceEventLineupEntries = vi.fn(async () => entries);
    const replaceEventLineup = vi.fn(async () => []);
    const repositories = {
      getEntriesForEvent: async () => entries,
      replaceEventLineupEntries,
      getLineupArtistIds: async () => ['artist-a', 'artist-b'],
      replaceEventLineup,
    };

    const first = await writeCanonicalStructuredLineup({
      eventId: 'evt-1',
      entries,
      context: { source: 'import' },
      repositories,
    });
    const second = await writeCanonicalStructuredLineup({
      eventId: 'evt-1',
      entries,
      context: { source: 'import' },
      repositories: {
        ...repositories,
        getEntriesForEvent: async () => entries,
        getLineupArtistIds: async () => first.projectedArtistIds,
      },
      existingEntries: entries,
    });

    expect(first.wroteStructured).toBe(false);
    expect(first.wroteProjection).toBe(false);
    expect(second.wroteStructured).toBe(false);
    expect(second.wroteProjection).toBe(false);
    expect(replaceEventLineupEntries).not.toHaveBeenCalled();
    expect(replaceEventLineup).not.toHaveBeenCalled();
  });

  it('syncCompatibilityProjectionFromStructured repairs stale flat rows only', async () => {
    const entries = [soloEntry('artist-a', 0)];
    const replaceEventLineup = vi.fn(async () => []);
    await syncCompatibilityProjectionFromStructured({
      eventId: 'evt-1',
      repositories: {
        getEntriesForEvent: async () => entries,
        replaceEventLineupEntries: async () => entries,
        getLineupArtistIds: async () => ['stale-1', 'stale-2'],
        replaceEventLineup,
      },
    });
    expect(replaceEventLineup).toHaveBeenCalledWith('evt-1', [
      { artistId: 'artist-a', billingRole: 'support' },
    ]);
  });

  it('title inference runs only as last resort', () => {
    const record = {
      id: 'rec-1',
      sourceId: 'source-1',
      externalId: 'ext-1',
      normalizedPayload: {
        title: 'LEVI',
        artistNames: ['LEVI'],
        startDate: '2026-09-01T22:00:00.000Z',
      },
      status: 'imported',
      importJobId: 'job-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as ImportRecord;

    expect(hasHigherTrustLineupEvidence(record)).toBe(true);
    expect(canRunTitleInference(record)).toBe(false);
    expect(buildTitleInferenceCandidates(record).entries).toHaveLength(0);
  });

  it('title inference is disabled for publish (proven root cause H_TITLE_INFERENCE_PROMOTED)', () => {
    const record = {
      id: 'rec-levi',
      sourceId: 'source-1',
      externalId: 'ext-1',
      normalizedPayload: {
        title: 'NIGHTSWITHUS presents LEVI',
        startDate: '2026-09-01T22:00:00.000Z',
      },
      status: 'imported',
      importJobId: 'job-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } as ImportRecord;

    expect(canRunTitleInference(record)).toBe(false);
    expect(buildTitleInferenceCandidates(record).entries).toHaveLength(0);
  });

  it('import publish does not call flat import pipeline', async () => {
    const replaceFromImportPipeline = vi.fn();
    const replaceStructuredLineupFromImport = vi.fn(async () => []);
    const lineupService = {
      replaceFromImportPipeline,
      replaceStructuredLineupFromImport,
      getLineupArtistIds: async () => [],
      getStructuredLineupForEvent: async () => [],
    } as unknown as Pick<
      EventLineupService,
      | 'replaceFromImportPipeline'
      | 'replaceStructuredLineupFromImport'
      | 'getLineupArtistIds'
      | 'getStructuredLineupForEvent'
    >;

    await writeImportPublishLineup({
      lineupService,
      record: {
        id: 'rec-1',
        sourceId: 'source-1',
        externalId: 'ext-1',
        normalizedPayload: { title: 'Into The Madness Pre-Party Weekender', startDate: '2026-09-01' },
        status: 'imported',
        importJobId: 'job-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      } as ImportRecord,
      eventId: 'evt-1',
    });

    expect(replaceFromImportPipeline).not.toHaveBeenCalled();
  });

  it('compatibility projection match detects stale flat rows', () => {
    const projected = buildCompatibilityProjectionFromStructured([soloEntry('a', 0)]);
    expect(compatibilityProjectionMatches(projected, ['a'])).toBe(true);
    expect(compatibilityProjectionMatches(projected, ['b'])).toBe(false);
  });
});
