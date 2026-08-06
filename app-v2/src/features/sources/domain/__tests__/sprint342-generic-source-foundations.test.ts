import { describe, expect, it } from 'vitest';

import {
  getSourceTypeDescriptor,
  inferSourceTypeDescriptorId,
  listSourceTypeDescriptors,
} from '@/features/sources/domain/source-type-descriptors';
import {
  isEnrichmentPublish,
  isEnrichmentPublishBehavior,
  resolveSourcePublishBehavior,
} from '@/features/import/domain/publish-behavior';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';
import { createBootshausTicketIoProductionSourceRecord } from '@/features/sources/production/ticket-io-source.core';
import { createAffenkaefigSourceRecord } from '@/features/sources/production/affenkaefig-source';
import { fieldTrustMergeService } from '@/features/import/services/field-trust-merge-service';
import type { AdminEventRecord } from '@/data/types/records';

describe('source-type-descriptors', () => {
  it('lists all generic descriptor ids', () => {
    expect(listSourceTypeDescriptors().map((d) => d.id)).toContain('TICKETING_PLATFORM');
    expect(listSourceTypeDescriptors().map((d) => d.id)).toContain('VENUE_WEBSITE');
  });

  it('infers venue website from club role', () => {
    expect(
      inferSourceTypeDescriptorId({ sourceType: 'website', sourceRoles: ['club', 'venue'] }),
    ).toBe('VENUE_WEBSITE');
  });

  it('infers ticketing platform from ticket_platform type', () => {
    expect(inferSourceTypeDescriptorId({ sourceType: 'ticket_platform' })).toBe('TICKETING_PLATFORM');
    expect(getSourceTypeDescriptor('TICKETING_PLATFORM').defaultPublishBehavior).toBe('enrichment');
  });
});

describe('publish-behavior', () => {
  it('resolves bootshaus website as auto_publish', () => {
    const source = createBootshausProductionSourceRecord();
    expect(resolveSourcePublishBehavior(source)).toBe('auto_publish');
    expect(isEnrichmentPublish(source, true)).toBe(false);
  });

  it('resolves ticket.io bootshaus as enrichment', () => {
    const source = createBootshausTicketIoProductionSourceRecord();
    expect(resolveSourcePublishBehavior(source)).toBe('enrichment');
    expect(isEnrichmentPublishBehavior(resolveSourcePublishBehavior(source))).toBe(true);
    expect(isEnrichmentPublish(source, true)).toBe(true);
    expect(isEnrichmentPublish(source, false)).toBe(false);
  });

  it('resolves affenkaefig website as manual_review', () => {
    const source = createAffenkaefigSourceRecord();
    expect(resolveSourcePublishBehavior(source)).toBe('manual_review');
  });

  it('legacy ticket_platform without explicit behavior still resolves enrichment', () => {
    const source = createBootshausTicketIoProductionSourceRecord({
      sourceConfig: {
        ticketPlatform: createBootshausTicketIoProductionSourceRecord().sourceConfig?.ticketPlatform,
        publishPolicy: { mode: 'manual_review', blockOnDuplicate: false },
      },
    });
    expect(resolveSourcePublishBehavior(source)).toBe('enrichment');
  });
});

describe('field-trust-merge-service', () => {
  const existing: AdminEventRecord = {
    id: 'evt-1',
    title: 'Bootshaus Night',
    description: 'Official description',
    startDate: '2026-08-01T22:00:00.000Z',
    ticketUrl: undefined,
    imageUrl: 'https://bootshaus.tv/flyer.jpg',
    sourceId: 'source-bootshaus-koeln',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('enrichment only fills ticketUrl and preserves image', () => {
    const ticketSource = createBootshausTicketIoProductionSourceRecord();
    const result = fieldTrustMergeService.mergeAdminEvent({
      existing,
      candidate: {
        externalId: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
        sourceId: ticketSource.id,
        sourceName: ticketSource.displayName,
        title: 'Different Title',
        startDate: '2026-08-01T23:00:00.000Z',
        ticketUrl: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
        imageUrl: 'https://ticket.io/other.jpg',
        rawSourceType: 'json_ld',
      },
      source: ticketSource,
      behavior: 'enrichment',
    });

    expect(result.isEnrichment).toBe(true);
    expect(result.event.title).toBe('Bootshaus Night');
    expect(result.event.ticketUrl).toBe('https://bootshaus-club.ticket.io/gPHSUV3l/');
    expect(result.event.imageUrl).toBe('https://bootshaus.tv/flyer.jpg');
    expect(result.event.sourceId).toBe('source-bootshaus-koeln');
  });

  it('auto_publish allows ticketUrl from ticketing tier', () => {
    const ticketSource = createBootshausTicketIoProductionSourceRecord({
      publishMode: 'auto_publish',
      sourceConfig: {
        ...createBootshausTicketIoProductionSourceRecord().sourceConfig,
        publishPolicy: { mode: 'auto_publish', behavior: 'auto_publish', blockOnDuplicate: false },
      },
    });
    const result = fieldTrustMergeService.mergeAdminEvent({
      existing,
      candidate: {
        externalId: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
        sourceId: ticketSource.id,
        sourceName: ticketSource.displayName,
        title: 'Ignored',
        startDate: existing.startDate,
        ticketUrl: 'https://bootshaus-club.ticket.io/gPHSUV3l/',
        rawSourceType: 'json_ld',
      },
      source: ticketSource,
      behavior: 'auto_publish',
    });

    expect(result.event.ticketUrl).toBe('https://bootshaus-club.ticket.io/gPHSUV3l/');
    expect(result.event.title).toBe('Bootshaus Night');
    expect(result.decisions.some((d) => d.field === 'ticketUrl' && d.decision === 'accepted')).toBe(true);
  });
});
