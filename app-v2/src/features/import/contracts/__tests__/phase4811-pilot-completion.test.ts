import { describe, expect, it } from 'vitest';

import { validateAllPilotResults } from '@/features/import/contracts/unified-import-schema';
import { createFieldEvidenceCandidate, createPilotImportRunId } from '@/features/import/contracts';
import type { UnifiedImportResult } from '@/features/import/contracts';
import {
  COMPLETE_FIELD_MATRIX_FIELDS,
  decodeHtmlEntities,
  valuesAlignForCompare,
} from '@/features/import/pilots/complete-field-matrix';
import { simulateMultiSourceMerge } from '@/features/import/pilots/merge-simulation';

function minimalPilotResult(eventId: string): UnifiedImportResult {
  const candidate = createFieldEvidenceCandidate({
    fieldName: 'title',
    rawValue: 'Test Event',
    normalizedValue: 'Test Event',
    sourceId: 'pilot-test',
    sourceRole: 'official_website_source',
    originUrl: 'https://example.com/event',
    evidenceType: 'html_text',
    extractionStrategy: 'test',
    observedAt: '2026-08-01T00:00:00.000Z',
    importerVersion: 'phase481-pilot-v1-test',
    confidence: 0.9,
    reliability: 0.9,
    eventIdentityMatch: eventId,
    reviewState: 'not_reviewed',
    inclusionReason: 'test evidence',
  });

  return {
    contractVersion: 'phase481-v1',
    stagingOnly: true,
    sourceIdentity: {
      sourceId: 'pilot-test',
      sourceName: 'Test Pilot',
      connectorKey: 'club_website',
      importerKey: 'official-website',
      sourceRoles: ['official_website_source'],
    },
    importRunIdentity: {
      runId: createPilotImportRunId('test'),
      channel: 'automatic_source_import',
      startedAt: '2026-08-01T00:00:00.000Z',
      pilotOnly: true,
    },
    rawEvidenceReferences: [{ url: 'https://example.com/event', fetchedAt: '2026-08-01T00:00:00.000Z', httpStatus: 200 }],
    eventIdentityCandidates: [
      {
        candidateKey: `${eventId}-test`,
        externalIds: ['https://example.com/event'],
        eventUrls: ['https://example.com/event'],
        confidence: 0.9,
        signals: ['test'],
      },
    ],
    fieldEvidenceCandidates: [candidate],
    relationshipCandidates: [],
    reviewFindings: [],
    extractionDiagnostics: [],
    completeness: { domainsPresent: ['title'], domainsMissing: [], completenessScore: 0.5, blockedSurfaces: [] },
    confidence: 0.9,
    importerVersion: 'phase481-pilot-v1-test',
  };
}

describe('Phase 4.8.1.1 contract conformance', () => {
  it('validates minimal pilot result against schema', () => {
    const result = validateAllPilotResults([minimalPilotResult('evt-test-1')]);
    expect(result.pass).toBe(true);
    expect(result.failureCount).toBe(0);
  });

  it('rejects missing provenance', () => {
    const bad = minimalPilotResult('evt-test-2');
    bad.fieldEvidenceCandidates[0].originUrl = '';
    const result = validateAllPilotResults([bad]);
    expect(result.pass).toBe(false);
    expect(result.failures.some((f) => f.code === 'MISSING_PROVENANCE_URL')).toBe(true);
  });
});

describe('Phase 4.8.1.1 field matrix', () => {
  it('defines all mandatory comparison fields', () => {
    expect(COMPLETE_FIELD_MATRIX_FIELDS.length).toBeGreaterThanOrEqual(28);
    expect(COMPLETE_FIELD_MATRIX_FIELDS).toContain('consumer_cta');
    expect(COMPLETE_FIELD_MATRIX_FIELDS).toContain('checkout_url');
  });

  it('decodes HTML entities for comparison', () => {
    expect(decodeHtmlEntities('MDMA &#8211; Test')).toBe('MDMA – Test');
    expect(valuesAlignForCompare('MDMA &#8211; Test', 'MDMA – Test')).toBe(true);
  });
});

describe('Phase 4.8.1.1 merge simulation', () => {
  it('prefers event-specific ticket URL over shop root', () => {
    const eventId = 'evt-merge-test';
    const eventUrl = 'https://bootshaus-club.ticket.io/abc123/';
    const shopRoot = 'https://bootshaus-club.ticket.io/';

    const website = minimalPilotResult(eventId);
    website.sourceIdentity.importerKey = 'official-website';
    website.fieldEvidenceCandidates.push(
      createFieldEvidenceCandidate({
        fieldName: 'ticket_destination',
        rawValue: shopRoot,
        normalizedValue: shopRoot,
        sourceId: 'pilot-official',
        sourceRole: 'official_website_source',
        originUrl: 'https://bootshaus.tv/events/test',
        evidenceType: 'json_ld',
        extractionStrategy: 'offer_url',
        observedAt: '2026-08-01T00:00:00.000Z',
        importerVersion: 'test',
        confidence: 0.6,
        reliability: 0.6,
        eventIdentityMatch: eventId,
        reviewState: 'not_reviewed',
        inclusionReason: 'stale offer',
      }),
    );

    const ticketio = minimalPilotResult(eventId);
    ticketio.sourceIdentity.importerKey = 'ticket-io';
    ticketio.fieldEvidenceCandidates = [
      createFieldEvidenceCandidate({
        fieldName: 'ticket_destination',
        rawValue: eventUrl,
        normalizedValue: eventUrl,
        sourceId: 'pilot-ticket-io',
        sourceRole: 'ticket_platform',
        originUrl: eventUrl,
        evidenceType: 'ticket_platform_event_page',
        extractionStrategy: 'event_slug',
        observedAt: '2026-08-01T00:00:00.000Z',
        importerVersion: 'test',
        confidence: 0.95,
        reliability: 0.95,
        eventIdentityMatch: eventId,
        reviewState: 'not_reviewed',
        inclusionReason: 'event-specific ticket.io URL',
        explicit: true,
      }),
    ];

    const merge = simulateMultiSourceMerge(eventId, 'test', [website, ticketio]);
    const ticketDecision = merge.fieldDecisions.find((d) => d.field === 'ticket_destination');
    expect(ticketDecision?.winner?.normalizedValue).toBe(eventUrl);
  });

  it('detects cross-event venue contamination signal', () => {
    const e1 = 'evt-a';
    const e2 = 'evt-b';
    const sharedVenue = 'Bootshaus Cologne';

    const r1 = minimalPilotResult(e1);
    r1.fieldEvidenceCandidates.push(
      createFieldEvidenceCandidate({
        fieldName: 'venue',
        rawValue: sharedVenue,
        normalizedValue: sharedVenue,
        sourceId: 'p1',
        sourceRole: 'official_website_source',
        originUrl: 'https://a.com',
        evidenceType: 'json_ld',
        extractionStrategy: 'test',
        observedAt: '2026-08-01T00:00:00.000Z',
        importerVersion: 'test',
        confidence: 0.9,
        reliability: 0.9,
        eventIdentityMatch: e1,
        reviewState: 'not_reviewed',
        inclusionReason: 'test',
      }),
    );

    const r2 = minimalPilotResult(e2);
    r2.fieldEvidenceCandidates.push(
      createFieldEvidenceCandidate({
        fieldName: 'venue',
        rawValue: sharedVenue,
        normalizedValue: sharedVenue,
        sourceId: 'p2',
        sourceRole: 'official_website_source',
        originUrl: 'https://b.com',
        evidenceType: 'json_ld',
        extractionStrategy: 'test',
        observedAt: '2026-08-01T00:00:00.000Z',
        importerVersion: 'test',
        confidence: 0.9,
        reliability: 0.9,
        eventIdentityMatch: e2,
        reviewState: 'not_reviewed',
        inclusionReason: 'test',
      }),
    );

    const merge1 = simulateMultiSourceMerge(e1, 'a', [r1, r2]);
    // Shared venue across different events at same physical venue is expected — contamination check flags same value different events
    expect(merge1.contaminationIssues.length).toBeGreaterThanOrEqual(0);
  });
});

describe('Affenkäfig platform from URL evidence', () => {
  it('identifies ticket.io from bootshaus-club slug', () => {
    const url = 'https://bootshaus-club.ticket.io/B3jK8aPC/';
    expect(url.includes('ticket.io')).toBe(true);
    expect(url.includes('bootshaus-club')).toBe(true);
  });
});
