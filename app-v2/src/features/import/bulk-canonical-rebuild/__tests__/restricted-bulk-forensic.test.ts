import { describe, expect, it } from 'vitest';

import {
  auditCandidateForensic,
  buildFieldGroupPatch,
  buildRestrictedBulkManifest,
  isInvalidPriorManifestHash,
  selectRestrictedBulkCandidates,
} from '@/features/import/bulk-canonical-rebuild/restricted-bulk-forensic';
import type { BulkRebuildEventRow } from '@/features/import/bulk-canonical-rebuild/types';

function baseRow(overrides: Partial<BulkRebuildEventRow> = {}): BulkRebuildEventRow {
  return {
    eventIdBefore: 'evt-test-1',
    clusterId: 'cluster-1',
    rowOrigin: 'identity_cluster',
    disposition: 'ready_partial',
    idPreservation: 'preserve_existing_id',
    changeSet: {},
    reviewReasons: [],
    manualLocks: [],
    existing: {
      id: 'evt-test-1',
      title: 'Test Event',
      startDate: '2026-12-01T20:00:00+00:00',
      endDate: '2026-12-02T04:00:00+00:00',
      venueName: 'Bootshaus',
      organizerName: 'Org',
      websiteUrl: 'https://bootshaus.com/events/test',
      ticketUrl: 'https://bootshaus.com/events/test',
      priceText: 'ab 20,00 €',
      ticketStatus: 'on_sale',
      genreLabels: ['Techno'],
      description: 'Official description',
      status: 'upcoming',
    },
    rebuilt: {
      title: 'Test Event',
      startDate: '2026-12-01T20:00:00.000Z',
      endDate: '2026-12-02T04:00:00.000Z',
      venueName: 'Bootshaus',
      organizerName: 'Org',
      websiteUrl: 'https://bootshaus.com/events/test',
      ticketUrl: 'https://bootshaus.com/events/test',
      priceText: 'ab 25,00 €',
      ticketStatus: 'on_sale',
      genreLabels: ['Techno'],
      description: 'Official description',
      verifiedAt: '2026-08-10T12:00:00.000Z',
      publishCoreSecure: true,
      evidenceByFieldGroup: {
        tickets: ['checkout_evidence'],
      },
    },
    sourceContributions: [
      {
        sourceId: 'source-bootshaus',
        externalId: 'https://bootshaus.com/events/test',
        identityVerdict: 'exact',
        verifiedAt: '2026-08-10T12:00:00.000Z',
        candidate: {
          sourceId: 'source-bootshaus',
          externalId: 'https://bootshaus.com/events/test',
          eventUrl: 'https://bootshaus.com/events/test',
        },
        bundle: {
          sourceRole: 'official_website_source',
          sourceNativeEvidence: true,
          identity: {
            pageTitle: 'Test Event',
            eventDate: '2026-12-01',
            venueName: 'Bootshaus',
          },
        },
        detailEvidence: {
          fetchStatus: 'ok',
        },
      },
    ],
    collision: {
      clusterCollision: false,
      isolatedContributionKeys: [],
    },
    consumerBefore: { displayPriceText: 'ab 20,00 €' },
    consumerAfter: { displayPriceText: 'ab 25,00 €' },
    ...overrides,
  };
}

describe('restricted bulk forensic', () => {
  it('rejects prior phase 48673 manifest hash', () => {
    expect(
      isInvalidPriorManifestHash(
        '978aed3839e10116d7b2cab20564c2e6c9ec045869cd73401780820bd175dad5',
      ),
    ).toBe(true);
  });

  it('timezone-only schedule change is safe_no_change', () => {
    const row = baseRow({
      changeSet: {
        startDate: {
          before: '2026-12-01T20:00:00+00:00',
          after: '2026-12-01T20:00:00.000Z',
        },
      },
    });
    const audit = auditCandidateForensic(row);
    expect(audit.finalEligibility).toBe('safe_no_change');
    expect(audit.proposedFields).toEqual([]);
  });

  it('safe_field_patch only includes allowed material fields', () => {
    const row = baseRow({
      changeSet: {
        priceText: { before: 'ab 20,00 €', after: 'ab 25,00 €' },
        websiteUrl: {
          before: 'https://bootshaus.com/events/test',
          after: 'https://ticket.io/events/test',
        },
      },
    });
    const audit = auditCandidateForensic(row);
    expect(audit.finalEligibility).toBe('safe_field_patch');
    expect(audit.proposedFields).toEqual(['priceText']);
    expect(audit.proposedFields).not.toContain('websiteUrl');
  });

  it('does not produce whole-row replacement patch', () => {
    const row = baseRow({
      changeSet: {
        priceText: { before: 'ab 20,00 €', after: 'ab 25,00 €' },
      },
    });
    const audit = auditCandidateForensic(row);
    const patch = buildFieldGroupPatch(row, audit);
    expect(Object.keys(patch)).toEqual(['priceText']);
    expect(patch.title).toBeUndefined();
  });

  it('collision candidate is excluded', () => {
    const row = baseRow({
      disposition: 'review_collision',
      collision: { clusterCollision: true, isolatedContributionKeys: ['a'] },
      changeSet: {
        priceText: { before: 'ab 20,00 €', after: 'ab 25,00 €' },
      },
    });
    const audit = auditCandidateForensic(row);
    expect(audit.finalEligibility).toBe('review_collision');
  });

  it('manual lock blocks patch', () => {
    const row = baseRow({
      manualLocks: ['priceText'],
      changeSet: {
        priceText: { before: 'ab 20,00 €', after: 'ab 25,00 €' },
      },
    });
    const audit = auditCandidateForensic(row);
    expect(audit.finalEligibility).toBe('blocked_manual_lock');
  });

  it('on_sale stays on_sale when offer remains', () => {
    const row = baseRow({
      changeSet: {
        ticketStatus: { before: 'on_sale', after: 'external_link' },
      },
    });
    const audit = auditCandidateForensic(row);
    expect(audit.proposedFields).not.toContain('ticketStatus');
  });

  it('identical normalized field yields safe_no_change', () => {
    const row = baseRow({
      changeSet: {
        genreLabels: { before: ['Techno'], after: ['Techno'] },
      },
    });
    const audit = auditCandidateForensic(row);
    expect(audit.finalEligibility).toBe('safe_no_change');
  });

  it('provenance plan only for deltas in manifest', () => {
    const row = baseRow({
      changeSet: {
        priceText: { before: 'ab 20,00 €', after: 'ab 25,00 €' },
      },
    });
    const audit = auditCandidateForensic(row);
    const manifest = buildRestrictedBulkManifest([audit], [row]);
    const entry = (manifest.entries as Array<Record<string, unknown>>)[0];
    expect(entry.provenancePlan).toEqual([
      {
        fieldPath: 'priceText',
        sourceId: 'source-bootshaus',
        freshnessAt: '2026-08-10T12:00:00.000Z',
      },
    ]);
  });

  it('rollback includes ticketPhases null', () => {
    const row = baseRow({
      changeSet: {
        priceText: { before: 'ab 20,00 €', after: 'ab 25,00 €' },
      },
    });
    const audit = auditCandidateForensic(row);
    const manifest = buildRestrictedBulkManifest([audit], [row]);
    const entry = (manifest.entries as Array<Record<string, unknown>>)[0];
    expect((entry.rollback as { ticketPhases: null }).ticketPhases).toBeNull();
  });

  it('deterministic selection returns same candidates', () => {
    const rows = [
      baseRow({
        eventIdBefore: 'evt-a',
        changeSet: { priceText: { before: 'a', after: 'b' } },
      }),
      baseRow({
        eventIdBefore: 'evt-b',
        changeSet: { priceText: { before: 'a', after: 'c' } },
        sourceContributions: [
          {
            sourceId: 'source-ticket',
            externalId: 'https://ticket.io/a',
            identityVerdict: 'corroborated',
            verifiedAt: '2026-08-10T12:00:00.000Z',
            candidate: {
              sourceId: 'source-ticket',
              externalId: 'https://ticket.io/a',
              ticketUrl: 'https://ticket.io/a',
            },
            bundle: {
              sourceRole: 'ticket_platform',
              sourceNativeEvidence: true,
              identity: { pageTitle: 'Test Event' },
            },
            detailEvidence: { fetchStatus: 'content_unusable' },
          },
        ],
      }),
    ];
    const audits = rows.map((row) => auditCandidateForensic(row));
    const first = selectRestrictedBulkCandidates(audits, rows, 10, 1).map((a) => a.eventId);
    const second = selectRestrictedBulkCandidates(audits, rows, 10, 1).map((a) => a.eventId);
    expect(first).toEqual(second);
  });

  it('changeSet without after is not treated as destructive patch', () => {
    const row = baseRow({
      changeSet: {
        description: { before: 'Keep me', after: undefined },
        organizerName: { before: 'Org', after: undefined },
      },
    });
    const audit = auditCandidateForensic(row);
    expect(audit.finalEligibility).not.toBe('blocked_destructive_patch');
    expect(audit.proposedFields).toEqual([]);
  });

  it('manifest hash is stable without timestamps in body', () => {
    const row = baseRow({
      changeSet: {
        priceText: { before: 'ab 20,00 €', after: 'ab 25,00 €' },
      },
    });
    const audit = auditCandidateForensic(row);
    const one = buildRestrictedBulkManifest([audit], [row]).manifestHash;
    const two = buildRestrictedBulkManifest([audit], [row]).manifestHash;
    expect(one).toBe(two);
    expect(String(one)).not.toMatch(/2026/);
  });
});
