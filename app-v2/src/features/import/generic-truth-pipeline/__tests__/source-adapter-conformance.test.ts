import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

import { exampleEventsTestAdapter } from '../adapters/example-events-test-adapter';
import {
  evaluateGenericTruthPublish,
  canonicalImportEventToEvidenceBundle,
} from '../index';

function baseEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-fixture-001',
    title: 'Fixture Event',
    description: '',
    startDate: '2026-09-15T20:00:00.000Z',
    status: 'published',
    sourceId: 'source-fixture',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function baseCandidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    title: 'Fixture Event',
    startDate: '2026-09-15T20:00:00.000Z',
    sourceId: 'source-fixture',
    sourceName: 'Fixture',
    externalId: 'ext-001',
    rawSourceType: 'club_website',
    sourceMetadata: {
      verifiedAt: '2026-08-06T12:00:00.000Z',
      observedAt: '2026-08-06T12:00:00.000Z',
      pageTitle: 'Fixture Event',
      eventDate: '2026-09-15T20:00:00.000Z',
    },
    ...overrides,
  };
}

describe('example-events.test adapter conformance', () => {
  it('returns bundle without real provider names', async () => {
    const bundle = await exampleEventsTestAdapter.fetchAndParse({
      sourceUrl: 'https://events.example-events.test/show/001',
      observedAt: '2026-08-06T12:00:00.000Z',
    });
    expect(bundle?.sourceId).toBe('source-example-events-test');
    expect(bundle?.identity.pageTitle).toContain("Synth Artist's Night");
    expect(bundle?.tickets?.excludedProducts).toContain('Locker');
    expect(bundle?.verifiedAt).toBeTruthy();
  });

  it('evaluates synthetic bundle through central publish gate', async () => {
    const bundle = await exampleEventsTestAdapter.fetchAndParse({
      sourceUrl: 'https://events.example-events.test/show/001',
    });
    const candidate = baseCandidate({
      sourceId: bundle!.sourceId,
      title: bundle!.identity.pageTitle ?? 'Synth',
      priceText: bundle!.tickets?.priceText,
      description: bundle!.content?.description,
      genreNames: bundle!.content?.genreLabels,
      sourceMetadata: {
        verifiedAt: bundle!.verifiedAt,
        pageTitle: bundle!.identity.pageTitle,
        eventDate: bundle!.identity.eventDate,
        venueName: bundle!.identity.venueName,
      },
    });
    const evaluation = evaluateGenericTruthPublish({
      existing: baseEvent({
        title: 'Synth Artist Night',
        venueName: bundle!.identity.venueName,
        startDate: bundle!.identity.eventDate!,
      }),
      candidate,
      bundle: bundle!,
      adapterId: exampleEventsTestAdapter.adapterId,
    });
    expect(['exact', 'corroborated', 'partial_review_only']).toContain(evaluation.identityVerdict);
    expect(evaluation.evidenceCoverage.verifiedAt).toBe(true);
    expect(evaluation.writesSuppressed).toBe(true);
  });
});

describe('generic publish gates', () => {
  it('blocks tickets when verifiedAt is missing', () => {
    const evaluation = evaluateGenericTruthPublish({
      existing: baseEvent(),
      candidate: baseCandidate({
        sourceMetadata: { pageTitle: 'Fixture Event', eventDate: '2026-09-15T20:00:00.000Z' },
        priceText: 'ab 20,00 €',
      }),
    });
    expect(evaluation.blockReasons).toContain('verified_at_missing');
    const tickets = evaluation.fieldGroups.find((g) => g.group === 'tickets');
    expect(tickets?.blocked || evaluation.blockReasons.length > 0).toBe(true);
  });

  it('does not block description when ticket price is blocked', () => {
    const evaluation = evaluateGenericTruthPublish({
      existing: baseEvent({ description: 'Old text' }),
      candidate: baseCandidate({
        description: 'Official body without ticket contamination',
        sourceMetadata: {
          verifiedAt: '2026-08-06T12:00:00.000Z',
          pageTitle: 'MDMA Collision Title',
          eventDate: '2026-10-10T20:00:00.000Z',
          contaminationDetected: true,
        },
      }),
    });
    const description = evaluation.fieldGroups.find((g) => g.group === 'description');
    expect(description?.blocked).toBe(false);
    expect(evaluation.collision).toBe(true);
  });

  it('does not mirror canonical ticketUrl into outbound evidence', () => {
    const bundle = canonicalImportEventToEvidenceBundle(
      baseCandidate({
        ticketUrl: 'https://shop.example/t/1',
        sourceMetadata: {
          verifiedAt: '2026-08-06T12:00:00.000Z',
        },
      }),
    );
    expect(bundle.tickets?.publicCtaCandidateUrl).toBeUndefined();
    expect(bundle.legacyFallbackUsed).toBe(true);
  });

  it('marks legacy fallback as unverifiable identity', () => {
    const evaluation = evaluateGenericTruthPublish({
      existing: baseEvent(),
      candidate: baseCandidate({ sourceMetadata: {} }),
    });
    expect(evaluation.legacyFallbackUsed).toBe(true);
    expect(evaluation.identityVerdict).toBe('unverifiable');
    expect(evaluation.policyEligible).toBe(false);
  });
});
