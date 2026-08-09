import { describe, expect, it } from 'vitest';

import {
  assertRepairKindAllowed,
  buildProvenanceRowFingerprint,
  buildStableProvenancePlanManifestHash,
  deduplicateAlternatives,
  fingerprintFromSnapshot,
  rejectApproximatedBeforeRestore,
  REPAIR_APPLY_SELECTED_AT_SENTINEL,
  type ProvenanceRollbackSnapshot,
} from '@/features/import/services/provenance-repair-manifest';
import {
  assessOfficialField,
  assessTicketFreshnessField,
  buildFreshnessOnlyAfterSnapshot,
  buildLiveReverificationAfterSnapshot,
  buildProvenancePlanEntry,
  CANARY_TICKET_EVIDENCE_VERIFIED_AT,
  OFFICIAL_BOOTSHAUS_SOURCE_ID,
  TICKET_IO_SOURCE_ID,
} from '@/features/import/services/provenance-reverification-plan';
import type { SourceEvidenceBundle } from '@/features/import/generic-truth-pipeline/source-evidence-contract';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

const CANARY_EVENT_ID = 'evt-1785339418526-dn9f7g0';
const OFFICIAL_URL = 'https://bootshaus.tv/events/bootshaus-on-a-ship-vol-iv';
const TICKET_URL = 'https://bootshaus-club.ticket.io/4zjKRnsa/';

const currentRow: ProvenanceRollbackSnapshot = {
  id: 'provenance-evt-1785339418526-dn9f7g0-title',
  selectedValue: 'Bootshaus on a Ship Vol. IV',
  selectedSourceId: TICKET_IO_SOURCE_ID,
  manuallyOverridden: false,
  alternatives: [
    {
      value: 'Bootshaus on a Ship Vol. IV',
      sourceId: OFFICIAL_BOOTSHAUS_SOURCE_ID,
      freshnessAt: '2026-08-02T21:20:06.937Z',
      originExternalId: OFFICIAL_URL,
    },
    {
      value: 'Bootshaus on a Ship Vol. IV',
      sourceId: TICKET_IO_SOURCE_ID,
      freshnessAt: '2026-08-09T19:22:13.576Z',
      originExternalId: TICKET_URL,
    },
  ],
  updatedAt: '2026-08-09T19:22:13.576+00:00',
  selectedAt: '2026-08-09T19:22:13.576+00:00',
  selectionReason: 'import_publish',
  confidence: null,
  freshnessAt: '2026-08-09T19:22:13.576+00:00',
  originExternalId: TICKET_URL,
  mergeDecision: null,
  selectedTier: 'ticket_platform',
};

function bundle(overrides: Partial<SourceEvidenceBundle> = {}): SourceEvidenceBundle {
  return {
    sourceId: OFFICIAL_BOOTSHAUS_SOURCE_ID,
    sourceRole: 'official_website_source',
    sourceUrl: OFFICIAL_URL,
    observedAt: '2026-08-09T20:00:00.000Z',
    verifiedAt: '2026-08-09T20:00:00.000Z',
    identity: {
      pageTitle: 'Bootshaus on a Ship Vol. IV',
      eventDate: '2026-09-13T12:00:00+00:00',
      venueName: 'KD Anleger Nr. 2',
    },
    content: {
      description: 'Bootshaus returns to the water.',
    },
    evidenceOrigin: 'official_website_public_truth',
    identityEvidenceOrigin: 'official_website_public_truth',
    sourceNativeEvidence: true,
    legacyFallbackUsed: false,
    criticalIdentitySelfDerived: false,
    ...overrides,
  };
}

function candidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: OFFICIAL_URL,
    sourceId: OFFICIAL_BOOTSHAUS_SOURCE_ID,
    sourceName: 'Bootshaus',
    title: 'Bootshaus on a Ship Vol. IV',
    description: 'Bootshaus returns to the water.',
    startDate: '2026-09-13T12:00:00+00:00',
    venueName: 'KD Anleger Nr. 2',
    venueCity: 'Köln',
    cityName: 'Köln',
    countryCode: 'DE',
    organizerName: 'Bootshaus',
    eventUrl: OFFICIAL_URL,
    rawSourceType: 'unknown',
    sourceMetadata: {
      pageTitle: 'Bootshaus on a Ship Vol. IV',
      eventDate: '2026-09-13T12:00:00+00:00',
      venueName: 'KD Anleger Nr. 2',
      verifiedAt: '2026-08-09T20:00:00.000Z',
    },
    ...overrides,
  };
}

describe('provenance reverification plan', () => {
  it('rejects approximated before restore attempts', () => {
    expect(() => rejectApproximatedBeforeRestore('source_reference_last_seen_at')).toThrow(
      /approximated_before_restore_rejected/,
    );
    expect(() =>
      assertRepairKindAllowed('exact_snapshot_restore', { hasExactStoredSnapshot: false }),
    ).toThrow(/approximated_before_restore_rejected/);
  });

  it('allows exact snapshot restore only with stored snapshot evidence', () => {
    expect(() =>
      assertRepairKindAllowed('exact_snapshot_restore', { hasExactStoredSnapshot: true }),
    ).not.toThrow();
  });

  it('allows live reverification only when confirmed', () => {
    expect(() =>
      assertRepairKindAllowed('live_source_reverification', { liveReverificationConfirmed: true }),
    ).not.toThrow();
    expect(() =>
      assertRepairKindAllowed('live_source_reverification', { liveReverificationConfirmed: false }),
    ).toThrow(/live_reverification_requires_confirmed_native_evidence/);
  });

  it('blocks ticket platform from selecting official provenance fields in reverification target', () => {
    const after = buildLiveReverificationAfterSnapshot({
      current: currentRow,
      officialSourceId: OFFICIAL_BOOTSHAUS_SOURCE_ID,
      confirmedEventValue: 'Bootshaus on a Ship Vol. IV',
      evidenceVerifiedAt: '2026-08-09T20:00:00.000Z',
      evidenceUrl: OFFICIAL_URL,
    });
    expect(after.selectedSourceId).toBe(OFFICIAL_BOOTSHAUS_SOURCE_ID);
    expect(after.selectedSourceId).not.toBe(TICKET_IO_SOURCE_ID);
  });

  it('keeps ticket.io alternatives when reverifying official selection', () => {
    const after = buildLiveReverificationAfterSnapshot({
      current: currentRow,
      officialSourceId: OFFICIAL_BOOTSHAUS_SOURCE_ID,
      confirmedEventValue: 'Bootshaus on a Ship Vol. IV',
      evidenceVerifiedAt: '2026-08-09T20:00:00.000Z',
      evidenceUrl: OFFICIAL_URL,
    });
    const sourceIds = after.alternatives.map((entry) => (entry as { sourceId: string }).sourceId);
    expect(sourceIds).toContain(TICKET_IO_SOURCE_ID);
    expect(sourceIds).toContain(OFFICIAL_BOOTSHAUS_SOURCE_ID);
    expect(new Set(sourceIds).size).toBe(sourceIds.length);
  });

  it('deduplicates alternatives by source id', () => {
    const merged = deduplicateAlternatives(currentRow.alternatives, {
      sourceId: TICKET_IO_SOURCE_ID,
      value: 'duplicate',
      freshnessAt: '2026-08-09T19:22:13.576Z',
    });
    const ticketEntries = merged.filter(
      (entry) => (entry as { sourceId: string }).sourceId === TICKET_IO_SOURCE_ID,
    );
    expect(ticketEntries).toHaveLength(1);
  });

  it('marks venueName as review when live official evidence disagrees with event', () => {
    const assessment = assessOfficialField('venueName', {
      candidate: candidate(),
      bundle: bundle(),
      event: {
        id: CANARY_EVENT_ID,
        title: 'Bootshaus on a Ship Vol. IV',
        venueName: 'Bootshaus',
        startDate: '2026-09-13T12:00:00+00:00',
        websiteUrl: OFFICIAL_URL,
      } as never,
      identityVerdict: 'exact',
      officialUrl: OFFICIAL_URL,
      manualLocked: false,
    });
    expect(assessment.repairKind).toBe('review_only');
    expect(assessment.reviewReasons).toContain('live_event_value_mismatch');
  });

  it('allows live reverification for matching official fields with native evidence', () => {
    const assessment = assessOfficialField('title', {
      candidate: candidate(),
      bundle: bundle(),
      event: {
        id: CANARY_EVENT_ID,
        title: 'Bootshaus on a Ship Vol. IV',
        startDate: '2026-09-13T12:00:00+00:00',
        websiteUrl: OFFICIAL_URL,
      } as never,
      identityVerdict: 'exact',
      officialUrl: OFFICIAL_URL,
      manualLocked: false,
    });
    expect(assessment.repairKind).toBe('live_source_reverification');
    expect(assessment.reverificationPossible).toBe(true);
  });

  it('marks missing age evidence as review_only', () => {
    const assessment = assessOfficialField('ageRestriction', {
      candidate: candidate({ sourceMetadata: {} }),
      bundle: bundle(),
      event: {
        id: CANARY_EVENT_ID,
        ageRestriction: 'ab 18 Jahren',
      } as never,
      identityVerdict: 'exact',
      officialUrl: OFFICIAL_URL,
      manualLocked: false,
    });
    expect(assessment.repairKind).toBe('review_only');
    expect(assessment.reviewReasons).toContain('no_explicit_age_restriction_evidence');
  });

  it('plans ticket freshness without guessing historical selected_at', () => {
    const assessment = assessTicketFreshnessField('priceText', {
      event: {
        priceText: 'ab 32,00 €',
        ticketUrl: TICKET_URL,
      } as never,
      ticketEvidenceUrl: TICKET_URL,
      ticketEvidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
      livePriceText: 'ab 32,00 €',
    });
    expect(assessment.repairKind).toBe('freshness_only_known_evidence');
    const after = buildFreshnessOnlyAfterSnapshot(currentRow, CANARY_TICKET_EVIDENCE_VERIFIED_AT);
    expect(after.freshnessAt).toBe(CANARY_TICKET_EVIDENCE_VERIFIED_AT);
    expect(after.selectedAt).toBe(currentRow.selectedAt);
  });

  it('requires live ticket url confirmation for ticketUrl freshness', () => {
    const mismatch = assessTicketFreshnessField('ticketUrl', {
      event: { ticketUrl: TICKET_URL } as never,
      ticketEvidenceUrl: TICKET_URL,
      ticketEvidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
      liveTicketUrl: 'https://other.example/',
    });
    expect(mismatch.repairKind).toBe('review_only');

    const confirmed = assessTicketFreshnessField('ticketUrl', {
      event: { ticketUrl: TICKET_URL } as never,
      ticketEvidenceUrl: TICKET_URL,
      ticketEvidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
      liveTicketUrl: TICKET_URL,
    });
    expect(confirmed.repairKind).toBe('freshness_only_known_evidence');
    expect(confirmed.confirmedByLiveEvidence).toBe(true);
  });

  it('builds a stable manifest hash without volatile repair apply timestamps', () => {
    const entry = buildProvenancePlanEntry({
      group: 'B',
      fieldPath: 'title',
      canonicalEventId: CANARY_EVENT_ID,
      current: currentRow,
      after: buildLiveReverificationAfterSnapshot({
        current: currentRow,
        officialSourceId: OFFICIAL_BOOTSHAUS_SOURCE_ID,
        confirmedEventValue: 'Bootshaus on a Ship Vol. IV',
        evidenceVerifiedAt: '2026-08-09T20:00:00.000Z',
        evidenceUrl: OFFICIAL_URL,
      }),
      repairKind: 'live_source_reverification',
      evidenceUrl: OFFICIAL_URL,
      evidenceVerifiedAt: '2026-08-09T20:00:00.000Z',
      repairReason: 'live_official_match',
    });
    expect(entry.afterSnapshot.selectedAt).toBe(REPAIR_APPLY_SELECTED_AT_SENTINEL);
    const hash = buildStableProvenancePlanManifestHash({
      phase: '4.8.6.6.4d',
      canonicalEventId: CANARY_EVENT_ID,
      ticketEvidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
      entries: [entry],
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(
      buildStableProvenancePlanManifestHash({
        phase: '4.8.6.6.4d',
        canonicalEventId: CANARY_EVENT_ID,
        ticketEvidenceVerifiedAt: CANARY_TICKET_EVIDENCE_VERIFIED_AT,
        entries: [entry],
      }),
    ).toBe(hash);
  });

  it('fingerprints current provenance rows deterministically', () => {
    const fingerprint = fingerprintFromSnapshot(
      currentRow.id,
      CANARY_EVENT_ID,
      'title',
      currentRow,
    );
    expect(fingerprint).toBe(
      buildProvenanceRowFingerprint({
        id: currentRow.id,
        canonical_event_id: CANARY_EVENT_ID,
        field_path: 'title',
        selected_value: currentRow.selectedValue,
        selected_source_id: currentRow.selectedSourceId,
        selected_at: currentRow.selectedAt,
        selection_reason: currentRow.selectionReason,
        alternatives: currentRow.alternatives,
        manually_overridden: currentRow.manuallyOverridden,
        updated_at: currentRow.updatedAt,
        confidence: currentRow.confidence,
        freshness_at: currentRow.freshnessAt,
        origin_external_id: currentRow.originExternalId,
        merge_decision: currentRow.mergeDecision,
        selected_tier: currentRow.selectedTier,
      }),
    );
  });
});
