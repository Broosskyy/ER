import { describe, expect, it } from 'vitest';

import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import {
  compareLegacyAndFieldTrustAdminEvent,
  summarizeFieldTrustComparisons,
} from '@/features/import/services/field-trust-comparison-service';

const baseEvent: AdminEventRecord = {
  id: 'evt-1',
  title: 'Bootshaus Night',
  description: 'Official description',
  startDate: '2026-09-01T22:00:00.000Z',
  ticketUrl: 'https://bootshaus-club.ticket.io/abc123/',
  priceText: 'ab 20,00 €',
  venueName: 'Bootshaus',
  sourceId: 'source-bootshaus-koeln',
  status: 'published',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const websiteSource: SourceRecord = {
  id: 'source-bootshaus-koeln',
  slug: 'bootshaus-koeln',
  stableKey: 'bootshaus-koeln',
  displayName: 'Bootshaus Website',
  sourceType: 'website',
  parserType: 'html_selector',
  acquisitionStrategy: 'scheduled',
  status: 'active',
  enabled: true,
  archived: false,
  reviewRequired: false,
  priority: 80,
  trustScore: 90,
  requiresAuthentication: false,
  sourceRoles: ['club'],
  connectorKey: 'club_website',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const ticketSource: SourceRecord = {
  ...websiteSource,
  id: 'source-bootshaus-ticket-io',
  slug: 'bootshaus-ticket-io',
  displayName: 'Bootshaus Ticket.io',
  sourceType: 'ticket_platform',
  sourceRoles: ['ticketing'],
  connectorKey: 'ticket_io',
};

function candidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    title: baseEvent.title,
    startDate: baseEvent.startDate,
    sourceId: ticketSource.id,
    sourceName: ticketSource.displayName,
    externalId: 'ticket-1',
    description: 'Enriched ticket description',
    ticketUrl: 'https://bootshaus-club.ticket.io/abc123/',
    priceText: 'ab 22,00 €',
    ...overrides,
  };
}

describe('field trust comparison service', () => {
  it('reports identical legacy and trust results for enrichment fill-only updates', () => {
    const comparison = compareLegacyAndFieldTrustAdminEvent({
      existing: baseEvent,
      candidate: candidate({ description: 'Longer enriched description' }),
      source: ticketSource,
    });

    expect(comparison.identical).toBe(true);
    expect(comparison.diffs).toHaveLength(0);
  });

  it('reports unexpected divergence when legacy overwrites but trust rejects tier', () => {
    const comparison = compareLegacyAndFieldTrustAdminEvent({
      existing: { ...baseEvent, sourceId: ticketSource.id },
      candidate: candidate({ title: 'Aggregator Title Override', description: 'Aggregator description' }),
      source: websiteSource,
    });

    expect(
      comparison.diffs.some(
        (diff) => diff.category === 'unexpected' && diff.field === 'title',
      ),
    ).toBe(true);
  });

  it('respects manual_override locks in comparison output', () => {
    const provenance = new Map<string, FieldProvenance>([
      [
        'description',
        {
          value: baseEvent.description,
          selectedSourceId: 'manual_override',
          selectionReason: 'manual_override',
          alternatives: [],
          lastChangedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    ]);

    const comparison = compareLegacyAndFieldTrustAdminEvent({
      existing: baseEvent,
      candidate: candidate({ description: 'Overwrite attempt' }),
      source: websiteSource,
      provenanceByField: provenance,
    });

    expect(comparison.manualLocks).toContain('description');
    expect(
      comparison.diffs.some(
        (diff) => diff.category === 'blocked_manual_lock' && diff.field === 'description',
      ),
    ).toBe(true);
  });

  it('summarizes safe activation when comparisons are identical', () => {
    const comparisons = [
      compareLegacyAndFieldTrustAdminEvent({
        existing: baseEvent,
        candidate: candidate({ description: 'Longer enriched description' }),
        source: ticketSource,
      }),
    ];

    const summary = summarizeFieldTrustComparisons(comparisons);
    expect(summary.safeToEnable).toBe(true);
    expect(summary.identical).toBe(1);
  });
});
