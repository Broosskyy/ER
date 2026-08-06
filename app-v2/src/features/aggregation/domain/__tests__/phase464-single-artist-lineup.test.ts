import { describe, expect, it } from 'vitest';

import { resolveLineupCompletenessState } from '@/features/aggregation/domain/structured-lineup';
import { inferLineupCompleteness } from '@/features/event-detail/utils/lineup-completeness';
import { extractPrioritizedArtistNames } from '@/features/import/services/import-lineup-from-record';
import { toLineupSectionViewModel } from '@/features/event-detail/utils/event-detail-view-model';
import type { ImportRecord } from '@/features/import/models/types';
import type { EventDisplayModel } from '@/features/events/formatting/display-event';

function recordWithCandidate(candidate: Record<string, unknown>): ImportRecord {
  return {
    id: 'import-1',
    sourceId: 'source-test',
    status: 'pending',
    matchedArtistIds: [],
    normalizedPayload: candidate,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as ImportRecord;
}

function displayEvent(partial: Partial<EventDisplayModel>): EventDisplayModel {
  return {
    id: 'evt-1',
    title: 'Solo Night',
    venueLabel: 'Club',
    cityLabel: 'Berlin',
    genres: [],
    knownArtistNames: [],
    lineupCompleteness: 'full',
    ...partial,
  } as EventDisplayModel;
}

describe('phase 4.6.4 single-artist lineup policy', () => {
  it('treats one structured JSON-LD artist as complete', () => {
    const result = extractPrioritizedArtistNames(
      recordWithCandidate({
        title: 'NIKOLINA live',
        sourceMetadata: {
          lineupEntries: [{ displayName: 'NIKOLINA', source: 'json_ld', confidence: 0.95 }],
        },
      }),
    );
    expect(result.completeness).toBe('full');
    expect(resolveLineupCompletenessState({
      entries: [{ displayName: 'NIKOLINA', normalizedName: 'nikolina', source: 'json_ld', confidence: 0.95, sortOrder: 0 }],
    })).toBe('complete');
  });

  it('treats one HTML lineup section artist as complete', () => {
    const result = extractPrioritizedArtistNames(
      recordWithCandidate({
        title: 'Club Night',
        sourceMetadata: {
          lineupEntries: [{ displayName: 'MOONBOOTICA', source: 'html_lineup', confidence: 0.9 }],
        },
      }),
    );
    expect(result.completeness).toBe('full');
  });

  it('keeps title-inferred single artist partial', () => {
    const result = extractPrioritizedArtistNames(
      recordWithCandidate({
        title: 'DNB CONNECTION pres. SHOCKONE',
        artistNames: ['SHOCKONE'],
      }),
    );
    expect(result.completeness).toBe('partial');
    expect(result.source).toBe('title_inference');
  });

  it('does not show headliner badge for complete single-artist lineup', () => {
    const vm = toLineupSectionViewModel(
      displayEvent({
        title: 'NIKOLINA',
        knownArtistNames: ['NIKOLINA'],
        lineupCompleteness: 'full',
      }),
    );
    expect(vm?.artists[0]?.isHeadliner).toBeFalsy();
  });

  it('infers full completeness for structured single artist in projection', () => {
    expect(
      inferLineupCompleteness({ title: 'NIKOLINA', lineupEvidence: 'structured' }, 1),
    ).toBe('full');
  });

  it('filters non-artist labels from single-artist import', () => {
    const result = extractPrioritizedArtistNames(
      recordWithCandidate({
        title: 'Affenkäfig',
        artistNames: ['Organization', 'LEVI'],
      }),
    );
    expect(result.names).toEqual(['LEVI']);
  });
});
