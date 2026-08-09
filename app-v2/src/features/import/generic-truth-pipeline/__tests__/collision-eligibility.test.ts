import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { evaluateGenericTruthPublish } from '@/features/import/generic-truth-pipeline';
import { resolveServerGenericTruthRollout } from '@/features/import/generic-truth-pipeline/server-rollout-config';

function baseEvent(): AdminEventRecord {
  return {
    id: 'evt-collision-a',
    title: 'MDMA – Musik Die Mich Antreibt 10.10.26',
    startDate: '2026-10-10T20:00:00.000Z',
    venueName: 'Bootshaus',
    ticketUrl: 'https://bootshaus-club.ticket.io/Atz0dHLX/',
    status: 'published',
    sourceId: 'source-bootshaus-ticket-io',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

function chromeCandidate(): CanonicalImportEvent {
  return {
    title: 'CHROME COLOGNE',
    startDate: '2026-10-10T20:00:00.000Z',
    venueName: 'Bootshaus',
    ticketUrl: 'https://bootshaus-club.ticket.io/Atz0dHLX/',
    sourceId: 'source-bootshaus-ticket-io',
    sourceName: 'Bootshaus Ticket.io',
    externalId: 'Atz0dHLX',
    rawSourceType: 'api_json',
    sourceMetadata: {
      verifiedAt: '2026-08-06T12:00:00.000Z',
      observedAt: '2026-08-06T12:00:00.000Z',
      pageTitle: 'CHROME COLOGNE',
      listRowTitle: 'CHROME COLOGNE',
      eventDate: '2026-10-10T20:00:00.000Z',
      venueName: 'Bootshaus',
      connectorKey: 'ticket_platform',
      platform: 'ticket_io',
    },
  };
}

describe('composite collision in shadow evaluation', () => {
  it('blocks policy eligibility and marks review for colliding composite identity', () => {
    const existing = baseEvent();
    const competitor: AdminEventRecord = {
      ...baseEvent(),
      id: 'evt-collision-b',
      title: 'CHROME COLOGNE',
    };
    const evaluation = evaluateGenericTruthPublish({
      existing,
      candidate: chromeCandidate(),
      rollout: resolveServerGenericTruthRollout({ enabled: false, writesSuppressed: true }),
      collisionCatalog: [
        {
          eventId: existing.id,
          title: existing.title,
          startDate: existing.startDate,
          venueName: existing.venueName,
          ticketUrl: existing.ticketUrl,
        },
        {
          eventId: competitor.id,
          title: competitor.title,
          startDate: competitor.startDate,
          venueName: competitor.venueName,
          ticketUrl: competitor.ticketUrl,
        },
      ],
    });

    expect(evaluation.collision).toBe(true);
    expect(evaluation.policyEligible).toBe(false);
    expect(evaluation.reviewRequired).toBe(true);
    expect(evaluation.reviewReasons).toContain('identity_mismatch');
  });
});
