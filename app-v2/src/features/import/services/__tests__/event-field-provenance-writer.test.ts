import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';

import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';

function baseEvent(): AdminEventRecord {
  return {
    id: 'evt-freshness-1',
    title: 'Canary Event',
    description: 'Description',
    startDate: '2026-09-13T12:00:00+00:00',
    venueName: 'Venue',
    ticketUrl: 'https://shop.ticket.io/event/',
    priceText: 'ab 32,00 €',
    ticketStatus: 'on_sale',
    status: 'published',
    sourceId: 'source-ticket',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('EventFieldProvenanceWriter.writeFromPublish freshness', () => {
  it('stores evidence verifiedAt as freshness_at and apply time as lastChangedAt', async () => {
    const multiSource = new InMemoryMultiSourceRepositories();
    const writer = new EventFieldProvenanceWriter(multiSource.fieldProvenance);
    const evidenceVerifiedAt = '2026-08-09T19:21:16.347Z';
    const publishAuditAt = '2026-08-09T19:22:13.576Z';

    await writer.writeFromPublish('evt-freshness-1', {
      id: 'source-ticket',
      slug: 'ticket',
      stableKey: 'ticket',
      displayName: 'Ticket',
      sourceType: 'ticket_platform',
      parserType: 'unknown',
      acquisitionStrategy: 'manual',
      status: 'active',
      enabled: true,
      archived: false,
      reviewRequired: false,
      priority: 65,
      trustScore: 70,
      requiresAuthentication: false,
      createdAt: publishAuditAt,
      updatedAt: publishAuditAt,
      connectorKey: 'ticket_platform',
      sourceRoles: ['ticketing'],
    }, baseEvent(), {
      publishedAt: publishAuditAt,
      evidenceVerifiedAt,
      originExternalId: 'https://shop.ticket.io/event/',
    });

    const priceText = await multiSource.fieldProvenance.findByFieldPath('evt-freshness-1', 'priceText');
    expect(priceText?.freshnessAt).toBe(evidenceVerifiedAt);
    expect(priceText?.lastChangedAt).toBe(publishAuditAt);
    const ticketAlt = priceText?.alternatives.find((entry) => entry.sourceId === 'source-ticket');
    expect(ticketAlt?.freshnessAt).toBe(evidenceVerifiedAt);
  });

  it('does not fall back to Date.now for freshness when evidence verifiedAt is missing', async () => {
    const multiSource = new InMemoryMultiSourceRepositories();
    const writer = new EventFieldProvenanceWriter(multiSource.fieldProvenance);
    const publishAuditAt = '2026-08-09T19:22:13.576Z';

    await writer.writeFromPublish(
      'evt-freshness-1',
      {
        id: 'source-ticket',
        slug: 'ticket',
        stableKey: 'ticket',
        displayName: 'Ticket',
        sourceType: 'ticket_platform',
        parserType: 'unknown',
        acquisitionStrategy: 'manual',
        status: 'active',
        enabled: true,
        archived: false,
        reviewRequired: false,
        priority: 65,
        trustScore: 70,
        requiresAuthentication: false,
        createdAt: publishAuditAt,
        updatedAt: publishAuditAt,
      },
      baseEvent(),
      { publishedAt: publishAuditAt },
    );

    const priceText = await multiSource.fieldProvenance.findByFieldPath('evt-freshness-1', 'priceText');
    expect(priceText?.lastChangedAt).toBe(publishAuditAt);
    expect(priceText?.freshnessAt).toBeUndefined();
    const ticketAlt = priceText?.alternatives.find((entry) => entry.sourceId === 'source-ticket');
    expect(ticketAlt?.freshnessAt).toBeUndefined();
  });
});
