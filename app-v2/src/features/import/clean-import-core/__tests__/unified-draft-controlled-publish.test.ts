import { describe, expect, it } from 'vitest';

import type { DraftEligibilityAssessment } from '../draft-publish-eligibility';
import type { ImportDraft } from '../import-draft';
import {
  buildStableManifestHash,
  fingerprint,
  mapFieldPreviewToImportPatch,
  selectDeterministicApprovedPublishCandidate,
  stableJson,
} from '../unified-draft-controlled-publish';

function mockAssessment(
  draftId: string,
  mutationFields: Array<{ field: string; proposedValue: unknown }>,
): DraftEligibilityAssessment {
  const fieldPreview = [
    ...mutationFields.map((entry) => ({
      field: entry.field,
      currentValue: 'before',
      proposedValue: entry.proposedValue,
      action: 'update' as const,
      sourceRole: 'ticket' as const,
    })),
    {
      field: 'title',
      currentValue: 'Same',
      proposedValue: 'Same',
      action: 'preserve' as const,
      sourceRole: 'ticket' as const,
    },
  ];
  return {
    draftId,
    storedReviewTrack: 'quick_review',
    storedReviewDecision: 'approved',
    suggestedReviewTrack: 'auto_ready',
    automaticPublishEligible: true,
    eligibilityReasons: ['core_complete'],
    blockingReasons: [],
    enrichmentGaps: [],
    identityVerdict: 'exact',
    genreDisposition: 'missing',
    publishOutcome: 'safe_existing_update',
    matchedEventIds: [`evt-${draftId}`],
    publishEligible: true,
    fieldPreview,
    consumerPreview: {
      cardRenderable: true,
      detailRenderable: true,
      title: 'Alpha Night',
      dateLabel: 'Fr., 05. Sep. 2026',
      venueLabel: 'Main Hall',
      genreChips: [],
      lineup: [],
      ctaRole: 'ticket',
      issues: [],
    },
  };
}

function mockDraft(draftId: string, verifiedAt = '2026-08-11T20:00:00.000Z'): ImportDraft {
  return {
    id: draftId,
    verifiedAt,
    evidence: [],
    proposedCanonicalEvent: {
      title: 'Alpha Night',
      startDate: '2026-09-05T22:00:00+02:00',
      venueName: 'Main Hall',
      locationText: 'Berlin',
      websiteUrl: 'https://events.example/nights/alpha',
    },
    sources: [
      {
        sourceId: 'source-a',
        sourceFamily: 'official_website',
        sourceUrl: 'https://events.example/nights/alpha',
      },
    ],
    genres: { items: [], normalizedLabels: [], chipSuggestions: [], uncertainLabels: [] },
    duplicates: [],
    reviewTrack: 'quick_review',
    reviewReasons: [],
    audit: {},
  } as unknown as ImportDraft;
}

describe('unified-draft-controlled-publish', () => {
  it('selects the approved candidate with the fewest field mutations', () => {
    const singleAssessment = mockAssessment('draft:beta', [
      { field: 'venueCity', proposedValue: 'Kreuzberg' },
    ]);
    const multiAssessment = mockAssessment('draft:alpha', [
      { field: 'venueCity', proposedValue: 'Mitte' },
      { field: 'description', proposedValue: 'Updated description' },
    ]);

    const selected = selectDeterministicApprovedPublishCandidate({
      assessments: [multiAssessment, singleAssessment],
      draftsById: new Map([
        ['draft:beta', mockDraft('draft:beta')],
        ['draft:alpha', mockDraft('draft:alpha')],
      ]),
    });

    expect(selected?.assessment.draftId).toBe('draft:beta');
    expect(selected?.mutationCount).toBe(1);
    expect(selected?.patch.venueCity).toBe('Kreuzberg');
  });

  it('maps only update and insert preview fields into the publish patch', () => {
    const patch = mapFieldPreviewToImportPatch([
      { field: 'title', action: 'preserve', proposedValue: 'Same' },
      { field: 'venueCity', action: 'update', proposedValue: 'Kreuzberg' },
      { field: 'genres', action: 'update', proposedValue: ['Techno'] },
      { field: 'minimumAge', action: 'insert', proposedValue: '18' },
    ]);

    expect(patch).toEqual({
      venueCity: 'Kreuzberg',
      genreLabels: ['Techno'],
      ageRestriction: 'ab 18 Jahren',
    });
  });

  it('builds a stable manifest hash without volatile timestamps', () => {
    const manifest = {
      draftId: 'draft:test',
      targetEventId: 'evt-test',
      eventBefore: { id: 'evt-test', venue_city: 'Berlin' },
      eventRowFingerprint: fingerprint({ id: 'evt-test', venue_city: 'Berlin' }),
      draftBefore: { id: 'record-1', status: 'approved' },
      provenanceBefore: [],
      sourceReferenceBefore: null,
      patch: { venueCity: 'Kreuzberg' },
      protectedFields: ['title'],
      rollback: {
        event: { id: 'evt-test', venue_city: 'Berlin' },
        provenance: [],
        sourceReference: null,
        importRecord: { id: 'record-1', status: 'approved' },
      },
    };

    const first = buildStableManifestHash(manifest);
    const second = buildStableManifestHash({
      ...manifest,
      draftBefore: { ...manifest.draftBefore, updated_at: '2026-08-12T10:00:00.000Z' },
    });

    expect(first).toBe(second);
    expect(stableJson({ b: 1, a: 2 })).toBe(stableJson({ a: 2, b: 1 }));
  });
});
