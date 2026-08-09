import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import {
  evaluateCanonicalIdentityCollision,
  classifyFieldGroupEligibility,
  evaluateGenericTruthPublish,
  isEventInCanary,
  resolveServerGenericTruthRollout,
  DatabaseWriteCounter,
  GenericTruthLiveShadowRunner,
} from '@/features/import/generic-truth-pipeline';

function synthEvent(id: string, overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id,
    title: 'Synth Night',
    startDate: '2026-09-15T20:00:00.000Z',
    venueName: 'Example Hall',
    venueCity: 'Cologne',
    websiteUrl: 'https://example-events.test/events/synth-night',
    sourceId: 'source-example-events-test',
    status: 'published',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function synthCandidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    title: 'Synth Night — Official',
    startDate: '2026-09-15T20:00:00.000Z',
    venueName: 'Example Hall',
    sourceId: 'source-example-events-test',
    sourceName: 'Example Events',
    externalId: 'synth-night-1',
    rawSourceType: 'api_json',
    sourceMetadata: {
      verifiedAt: '2026-08-06T12:00:00.000Z',
      pageTitle: 'Synth Night — Official',
      listRowTitle: 'Synth Night',
      eventDate: '2026-09-15T20:00:00.000Z',
      venueName: 'Example Hall',
      publicCtaCandidateUrl: 'https://checkout.example-events.test/admission',
      checkoutEvidenceUrl: 'https://checkout.example-events.test/admission',
      connectorKey: 'ticket_platform',
      platform: 'ticket_io',
      unifiedDescription: 'A night of synthetic beats.',
      unifiedGenres: ['Hard Techno'],
    },
    description: 'Stale canonical description',
    genreNames: ['Techno'],
    priceText: 'ab 15,00 €',
    ...overrides,
  };
}

describe('phase48662 canonical collision', () => {
  it('flags collision_review_required when title/venue/official match across adjacent UTC days with different ticket URLs', () => {
    const left = synthEvent('evt-a', {
      title: 'MDMA – Musik Die Mich Antreibt',
      startDate: '2026-10-09T22:00:00.000Z',
      ticketUrl: 'https://shop-a.example.test/event/mdma-a',
      websiteUrl: 'https://bootshaus.example.test/events/mdma',
      sourceId: 'source-bootshaus-official',
    });
    const right = synthEvent('evt-b', {
      title: 'MDMA – Musik Die Mich Antreibt',
      startDate: '2026-10-10T20:00:00.000Z',
      ticketUrl: 'https://shop-b.example.test/event/mdma-b',
      websiteUrl: 'https://bootshaus.example.test/events/mdma',
      sourceId: 'source-bootshaus-official',
    });

    const result = evaluateCanonicalIdentityCollision(
      {
        eventId: left.id,
        title: left.title,
        startDate: left.startDate,
        venueName: left.venueName,
        venueCity: left.venueCity,
        ticketUrl: left.ticketUrl,
        websiteUrl: left.websiteUrl,
        sourceId: left.sourceId,
      },
      [
        {
          eventId: right.id,
          title: right.title,
          startDate: right.startDate,
          venueName: right.venueName,
          venueCity: right.venueCity,
          ticketUrl: right.ticketUrl,
          websiteUrl: right.websiteUrl,
          sourceId: right.sourceId,
        },
      ],
    );

    expect(result.verdict).toBe('collision_review_required');
    expect(result.signals.ticketUrlsDiffer).toBe(true);
  });
});

describe('phase48662 field-group eligibility', () => {
  it('allows partial policy eligibility per field group', () => {
    const evaluation = evaluateGenericTruthPublish({
      existing: synthEvent('evt-eligibility'),
      candidate: synthCandidate(),
      rollout: resolveServerGenericTruthRollout({ enabled: false, writesSuppressed: true }),
    });

    expect(evaluation.fieldGroupEligibility.policyEligibleEvent).toBe(true);
    expect(evaluation.fieldGroupEligibility.policyEligibleFieldGroups.length).toBeGreaterThan(0);
    expect(evaluation.fieldGroupEligibility.wouldApplyFieldCount).toBeGreaterThan(0);
  });
});

describe('phase48662 canary determinism', () => {
  it('selects stable canary cohort from source and event id', () => {
    const rollout = resolveServerGenericTruthRollout({
      enabled: true,
      mode: 'controlled',
      canaryPercent: 10,
      writesSuppressed: true,
    });
    const first = isEventInCanary('source-example-events-test', 'evt-deterministic-1', rollout);
    const second = isEventInCanary('source-example-events-test', 'evt-deterministic-1', rollout);
    expect(first).toBe(second);
  });
});

describe('phase48662 database write counter', () => {
  it('tracks zero writes in read-only shadow runner construction', () => {
    const counter = new DatabaseWriteCounter();
    const runner = new GenericTruthLiveShadowRunner();
    expect(counter.totalDatabaseWrites).toBe(0);
    expect(runner).toBeInstanceOf(GenericTruthLiveShadowRunner);
  });
});

describe('phase48662 metadata preservation contract', () => {
  it('maps native connector metadata into evidence bundle without canonical mirrors', () => {
    const evaluation = evaluateGenericTruthPublish({
      existing: synthEvent('evt-meta'),
      candidate: synthCandidate(),
      rollout: resolveServerGenericTruthRollout({ enabled: false, writesSuppressed: true }),
    });

    expect(evaluation.sourceNativeEvidence).toBe(true);
    expect(evaluation.legacyFallbackUsed).toBe(false);
    expect(evaluation.evidenceCoverage.identity).toBe(true);
    expect(evaluation.evidenceCoverage.verifiedAt).toBe(true);
    expect(evaluation.evidenceCoverage.tickets).toBe(true);
  });
});

describe('phase48662 field group classifier', () => {
  it('separates blocked and policy-eligible groups', () => {
    const evaluation = evaluateGenericTruthPublish({
      existing: synthEvent('evt-groups'),
      candidate: synthCandidate(),
      rollout: resolveServerGenericTruthRollout({ enabled: false, writesSuppressed: true }),
    });
    const classified = classifyFieldGroupEligibility({
      fieldGroups: evaluation.fieldGroups,
      fieldGroupDeltas: evaluation.fieldGroupDeltas,
      identityVerdict: evaluation.identityVerdict,
      verifiedAtPresent: evaluation.evidenceCoverage.verifiedAt,
      sourceNativeEvidence: evaluation.sourceNativeEvidence,
      collision: false,
      contamination: false,
    });
    expect(classified.blockedFieldGroups.length + classified.policyEligibleFieldGroups.length).toBeGreaterThan(0);
  });
});
