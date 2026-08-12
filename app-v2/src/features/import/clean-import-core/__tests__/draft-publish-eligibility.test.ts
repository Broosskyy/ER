import { describe, expect, it } from 'vitest';

import {
  applyDuplicateUrlReconciliationToDraft,
  reconciledClusterToConnectorOutputs,
  reconcileDuplicateUrlClusters,
  type ReconciledDraftInput,
} from '../duplicate-url-reconciliation';
import type { ConnectorOutput } from '../event-evidence';
import type { ResolvedEventCluster } from '../cross-source-event-resolver';
import {
  assessDraftPublishEligibility,
  buildDraftPublishPreviewReport,
  buildFieldPublishPreview,
  decideSuggestedReviewTrack,
  type PublishedEventSnapshot,
} from '../draft-publish-eligibility';
import type { ImportDraft } from '../import-draft';
import { SourceAdapter } from '../source-adapter';
import { UnifiedImportDraftService } from '../unified-import-draft-service';

const VERIFIED_AT = '2026-08-11T20:00:00.000Z';
const SHARED_URL = 'https://events.example/nights/alpha';

function output(
  sourceId: string,
  overrides: Partial<ConnectorOutput> = {},
): ConnectorOutput {
  return {
    sourceId,
    sourceFamily: 'official_website',
    sourceUrl: SHARED_URL,
    verifiedAt: VERIFIED_AT,
    title: 'Alpha Night',
    startDate: '2026-09-05T22:00:00+02:00',
    venueName: 'Main Hall',
    officialWebsiteUrl: SHARED_URL,
    genres: ['Tech House'],
    diagnostics: [],
    ...overrides,
  };
}

function cluster(id: string, outputs: ConnectorOutput[]): ResolvedEventCluster {
  const contributions = outputs.map((entry, index) => ({
    contributionId: `${id}:contribution:${index}`,
    externalId: `${id}:external:${index}`,
    evidence: new SourceAdapter().adapt(entry),
  }));
  return {
    clusterId: id,
    contributionIds: contributions.map((entry) => entry.contributionId),
    contributions,
    diagnostics: [],
  };
}

function draftFrom(input: ReconciledDraftInput): ImportDraft {
  const outputs = reconciledClusterToConnectorOutputs(input);
  const draft = new UnifiedImportDraftService().process({
    id: `submission:${input.clusterId}`,
    kind: 'automatic_source',
    submitter: { role: 'system', trustHint: 'official_source' },
    submittedAt: VERIFIED_AT,
    sourceId: outputs[0]!.sourceId,
    externalId: 'stable-native-id',
    connectorOutputs: outputs,
  }).draft;
  return applyDuplicateUrlReconciliationToDraft(draft, input);
}

function safeDraft(overrides: Partial<ConnectorOutput> = {}): ImportDraft {
  const [input] = reconcileDuplicateUrlClusters([
    cluster('cluster-safe', [output('source-safe', overrides)]),
  ]).draftInputs;
  return draftFrom(input!);
}

function emptyBatch() {
  return { concreteUrlOwners: new Map(), manualLocksByEventId: new Map() };
}

function assess(
  draft: ImportDraft,
  publishedEvents: PublishedEventSnapshot[] = [],
) {
  return assessDraftPublishEligibility({
    draft,
    publishedEvents,
    batch: emptyBatch(),
  });
}

describe('draft publish eligibility', () => {
  it('classifies a safe core without genres as auto_ready', () => {
    const draft = safeDraft({ genres: undefined });
    const result = assess(draft);
    expect(result.suggestedReviewTrack).toBe('auto_ready');
    expect(result.automaticPublishEligible).toBe(true);
    expect(result.enrichmentGaps).toContain('genres_missing');
  });

  it('classifies a safe core without lineup, description, or image as auto_ready', () => {
    const draft = safeDraft({
      description: undefined,
      lineup: undefined,
      lineupState: undefined,
    });
    const result = assess(draft);
    expect(result.suggestedReviewTrack).toBe('auto_ready');
    expect(result.enrichmentGaps).toEqual(
      expect.arrayContaining(['lineup_missing', 'description_missing', 'image_missing']),
    );
  });

  it('keeps uncertain genres as enrichment hints instead of core blocks', () => {
    const draft = safeDraft({ genres: ['Mystery-Genre'] });
    const result = assess(draft);
    expect(result.suggestedReviewTrack).toBe('auto_ready');
    expect(result.genreDisposition).toBe('suggested_only');
    expect(result.enrichmentGaps).toContain('genres_uncertain');
    expect(result.blockingReasons).not.toContain('genres_missing');
  });

  it('routes a real date conflict to conflict_review', () => {
    const [input] = reconcileDuplicateUrlClusters([
      cluster('cluster-a', [output('source-a')]),
      cluster('cluster-b', [
        output('source-b', { startDate: '2026-09-06T22:00:00+02:00' }),
      ]),
    ]).draftInputs;
    const draft = draftFrom(input!);
    const result = assess(draft);
    expect(result.suggestedReviewTrack).toBe('conflict_review');
    expect(result.publishOutcome).toBe('not_publishable');
  });

  it('routes a unique draft to safe_new_event', () => {
    const result = assess(safeDraft());
    expect(result.publishOutcome).toBe('safe_new_event');
    expect(result.matchedEventIds).toEqual([]);
  });

  it('routes a unique existing match to safe_existing_update', () => {
    const draft = safeDraft({ description: 'Fresh description' });
    const published: PublishedEventSnapshot = {
      id: 'event-existing',
      title: 'Alpha Night',
      startDate: '2026-09-05T20:00:00+02:00',
      venueName: 'Main Hall',
      websiteUrl: SHARED_URL,
      description: 'Old description',
    };
    const result = assess(draft, [published]);
    expect(result.publishOutcome).toBe('safe_existing_update');
    expect(result.matchedEventIds).toEqual(['event-existing']);
    expect(result.fieldPreview.some((entry) => entry.action === 'update')).toBe(true);
  });

  it('routes identical existing data to safe_no_change', () => {
    const draft = safeDraft({ description: 'Stable description' });
    const published: PublishedEventSnapshot = {
      id: 'event-existing',
      title: 'Alpha Night',
      startDate: draft.proposedCanonicalEvent!.startDate,
      venueName: 'Main Hall',
      websiteUrl: SHARED_URL,
      description: 'Stable description',
      genreLabels: ['Tech House'],
    };
    const result = assess(draft, [published]);
    expect(result.publishOutcome).toBe('safe_no_change');
  });

  it('routes multiple existing matches to manual_conflict', () => {
    const draft = safeDraft();
    const published = [
      {
        id: 'event-a',
        title: 'Alpha Night',
        startDate: '2026-09-05T20:00:00+02:00',
        venueName: 'Main Hall',
        websiteUrl: SHARED_URL,
      },
      {
        id: 'event-b',
        title: 'Alpha Night',
        startDate: '2026-09-05T21:00:00+02:00',
        venueName: 'Main Hall',
        ticketUrl: SHARED_URL,
      },
    ];
    const result = assess(draft, published);
    expect(result.publishOutcome).toBe('manual_conflict');
    expect(result.matchedEventIds.length).toBeGreaterThan(1);
  });

  it('does not weaken confirmed genres in the field preview', () => {
    const draft = safeDraft({ genres: ['Techno', 'Tech-House'] });
    draft.genres.items.forEach((item) => {
      item.confirmed = true;
    });
    draft.genres.normalizedLabels = ['Techno', 'Tech House'];
    const preview = buildFieldPublishPreview(draft);
    expect(preview.find((entry) => entry.field === 'genres')?.proposedValue).toEqual([
      'Techno',
      'Tech House',
    ]);
  });

  it('keeps ticket and website URL roles separated', () => {
    const draft = safeDraft({
      sourceFamily: 'ticket_io',
      officialWebsiteUrl: undefined,
      publicTicketUrl: 'https://reference.ticket.io/alpha-night/',
      sourceUrl: 'https://reference.ticket.io/alpha-night/',
    });
    const preview = buildFieldPublishPreview(draft);
    expect(draft.proposedCanonicalEvent?.websiteUrl).toBeUndefined();
    expect(draft.proposedCanonicalEvent?.ticketUrl).toContain('ticket.io');
    expect(preview.find((entry) => entry.field === 'ticketUrl')).toBeTruthy();
    expect(preview.find((entry) => entry.field === 'websiteUrl')).toBeUndefined();
  });

  it('reports zero writes for preview-only execution', () => {
    const report = buildDraftPublishPreviewReport({
      drafts: [safeDraft()],
      reviewDecisions: new Map(),
      publishedEvents: [],
    });
    expect(report.summary.databaseWriteOperations).toBe(0);
    expect(report.summary.eventWriteRequests).toBe(0);
    expect(report.summary.draftWriteRequests).toBe(0);
    expect(report.summary.productionMutationsInThisRun).toBe(0);
    expect(report.summary.rolloutActivated).toBe(false);
  });

  it('does not classify missing optional fields alone as quick_review', () => {
    const track = decideSuggestedReviewTrack({
      draft: safeDraft({ genres: undefined, lineup: undefined }),
      blockingReasons: [],
      enrichmentGaps: ['genres_missing', 'lineup_missing'],
    });
    expect(track).toBe('auto_ready');
  });
});
