import { describe, expect, it } from 'vitest';

import {
  isDetailFetchBlocked,
  shouldRejectBlockedOriginOverwrite,
} from '@/features/events/domain/blocked-origin-guard';
import { getFieldFallbackChain, rankFieldEvidenceOrigin } from '@/features/events/domain/field-fallback-priority';
import { evaluatePublishQualityGate } from '@/features/events/quality/publish-quality-gate';
import { fieldTrustMergeService } from '@/features/import/services/field-trust-merge-service';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

describe('field fallback priority', () => {
  it('ranks website above ticket list for description', () => {
    expect(rankFieldEvidenceOrigin('description', 'website_structured')).toBeGreaterThan(
      rankFieldEvidenceOrigin('description', 'ticket_platform_list'),
    );
  });

  it('documents lineup fallback chain', () => {
    const chain = getFieldFallbackChain('lineup');
    expect(chain?.priority[0]).toBe('canonical_structured');
    expect(chain?.priority).toContain('flyer_extraction');
  });
});

describe('blocked origin guard', () => {
  it('detects PoW-blocked detail fetch', () => {
    expect(
      isDetailFetchBlocked({
        detailEnrichment: { skippedReason: 'pow_blocked', detailUrlsFetched: 0, detailUrlsAttempted: 5 },
      }),
    ).toBe(true);
  });

  it('rejects clearing description when detail is blocked', () => {
    const result = shouldRejectBlockedOriginOverwrite({
      field: 'description',
      existingValue: 'Long official description from website.',
      incomingValue: '',
      metadata: { detailEnrichment: { skippedReason: 'pow_blocked' } },
      isEnrichment: true,
    });
    expect(result.reject).toBe(true);
  });
});

describe('publish quality gate', () => {
  it('rejects empty overwrite of populated description', () => {
    const result = evaluatePublishQualityGate({
      field: 'description',
      existingValue: 'Official event copy',
      incomingValue: '',
      incomingTier: 'ticket_platform',
      existingTier: 'official_organizer',
      isEnrichment: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('empty_overwrites_populated');
  });

  it('rejects worse ticket URL', () => {
    const result = evaluatePublishQualityGate({
      field: 'ticketUrl',
      existingValue: 'https://bootshaus-club.ticket.io/wUc3uQrR/',
      incomingValue: 'https://bootshaus-club.ticket.io/',
      incomingTier: 'ticket_platform',
      existingTier: 'ticket_platform',
      isEnrichment: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('worse_ticket_url');
  });

  it('rejects genre downgrade', () => {
    const result = evaluatePublishQualityGate({
      field: 'genreLabels',
      existingValue: ['Techno', 'House'],
      incomingValue: ['Techno'],
      incomingTier: 'ticket_platform',
      existingTier: 'official_organizer',
      isEnrichment: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('fewer_genres');
  });
});

describe('field trust merge with quality gate', () => {
  const source = {
    id: 'source-bootshaus-ticket-io',
    sourceType: 'ticket_platform',
    sourceRoles: ['ticketing'],
    connectorKey: 'ticket_platform',
    displayName: 'Bootshaus Ticket.io',
  } as SourceRecord;

  const existing = {
    id: 'evt-1',
    title: 'Bootshaus on a Ship',
    description: 'Full website description with lineup details in prose.',
    ticketUrl: 'https://bootshaus-club.ticket.io/wUc3uQrR/',
    genreLabels: ['Techno', 'House'],
    startDate: '2026-08-09T14:00:00+02:00',
    sourceId: 'source-bootshaus-koeln',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as AdminEventRecord;

  it('does not let PoW-blocked ticket.io enrichment clear description', () => {
    const candidate = {
      title: 'Bootshaus on a Ship Vol. III',
      startDate: '2026-08-09T14:00:00+02:00',
      description: '',
      genreLabels: [],
      ticketUrl: 'https://bootshaus-club.ticket.io/',
      sourceMetadata: {
        platform: 'ticket_io',
        detailEnrichment: {
          skippedReason: 'pow_blocked',
          detailUrlsFetched: 0,
          detailUrlsAttempted: 10,
        },
      },
    } as CanonicalImportEvent;

    const result = fieldTrustMergeService.mergeAdminEvent({
      existing,
      candidate,
      source,
      behavior: 'enrichment',
    });

    expect(result.event.description).toBe(existing.description);
    expect(result.event.genreLabels).toEqual(existing.genreLabels);
    expect(result.event.ticketUrl).toBe(existing.ticketUrl);
  });
});
