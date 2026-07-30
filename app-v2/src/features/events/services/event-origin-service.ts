import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { SourceReference } from '@/features/aggregation/identity/event-identity';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { SourceRecord } from '@/data/types/records';
import type { ImportRecord } from '@/features/import/models/types';

import {
  buildOriginStableKey,
  type EventOrigin,
  type EventOriginSyncStatus,
  resolveOriginRole,
  resolvePlatformFromSource,
} from '@/features/events/domain/event-origin';

export interface UpsertEventOriginInput {
  canonicalEventId: string;
  source: SourceRecord;
  record: ImportRecord;
  candidate: CanonicalImportEvent;
  isPrimary?: boolean;
  syncStatus?: EventOriginSyncStatus;
}

function readMetadataString(
  metadata: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = metadata?.[key];
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function mapSourceReferenceToEventOrigin(
  reference: SourceReference & { id: string; canonicalEventId: string },
  extras?: Partial<EventOrigin>,
): EventOrigin {
  const metadata = (extras?.rawMetadata ?? {}) as Record<string, unknown>;
  return {
    id: reference.id,
    eventId: reference.canonicalEventId,
    sourceId: reference.sourceId,
    sourceType: extras?.sourceType ?? readMetadataString(metadata, 'sourceType'),
    platform: extras?.platform ?? readMetadataString(metadata, 'platform'),
    role: extras?.role ?? (readMetadataString(metadata, 'role') as EventOrigin['role']) ?? 'aggregator',
    externalId: reference.externalEventId,
    canonicalUrl: extras?.canonicalUrl ?? readMetadataString(metadata, 'canonicalUrl') ?? reference.originalUrl,
    eventUrl: extras?.eventUrl ?? readMetadataString(metadata, 'eventUrl') ?? reference.originalUrl,
    ticketUrl: extras?.ticketUrl ?? readMetadataString(metadata, 'ticketUrl'),
    organizerExternalId: extras?.organizerExternalId ?? readMetadataString(metadata, 'organizerExternalId'),
    checkoutProviderId: extras?.checkoutProviderId ?? readMetadataString(metadata, 'checkoutProviderId'),
    discoveredAt: extras?.discoveredAt ?? reference.firstSeenAt,
    firstSeenAt: reference.firstSeenAt,
    lastSeenAt: reference.lastSeenAt,
    lastSuccessfulSyncAt: extras?.lastSuccessfulSyncAt ?? reference.lastSeenAt,
    syncStatus: extras?.syncStatus ?? (reference.active ? 'active' : 'removed'),
    trustScore: extras?.trustScore ?? reference.sourceQuality,
    priority: reference.sourcePriority,
    isPrimary: extras?.isPrimary ?? false,
    isActive: reference.active,
    rawMetadata: metadata,
  };
}

export function buildEventOriginFromPublish(input: UpsertEventOriginInput): EventOrigin {
  const now = new Date().toISOString();
  const metadata = (input.candidate.sourceMetadata ?? {}) as Record<string, unknown>;
  const role = resolveOriginRole({
    sourceType: input.source.sourceType,
    sourceRoles: input.source.sourceRoles,
  });
  const platform = resolvePlatformFromSource({
    sourceType: input.source.sourceType,
    connectorKey: input.source.connectorKey,
    sourceConfig: input.source.sourceConfig as Record<string, unknown>,
    metadata: input.source.metadata as Record<string, unknown> | undefined,
  });

  const canonicalUrl =
    input.candidate.eventUrl ??
    input.candidate.originalLink ??
    input.record.originalUrl ??
    input.record.sourceUrl;
  const ticketUrl = input.candidate.ticketUrl ?? canonicalUrl;

  return {
    id: `origin-${buildOriginStableKey(input.source.id, input.record.externalId)}`,
    eventId: input.canonicalEventId,
    sourceId: input.source.id,
    sourceType: input.source.sourceType,
    platform,
    role,
    externalId: input.record.externalId,
    canonicalUrl,
    eventUrl: input.candidate.eventUrl ?? input.candidate.originalLink ?? canonicalUrl,
    ticketUrl,
    organizerExternalId: readMetadataString(metadata, 'organizerExternalId'),
    checkoutProviderId: readMetadataString(metadata, 'checkoutProviderId'),
    discoveredAt: input.record.retrievedAt ?? input.record.createdAt,
    firstSeenAt: input.record.retrievedAt ?? input.record.createdAt,
    lastSeenAt: now,
    lastSuccessfulSyncAt: now,
    syncStatus: input.syncStatus ?? 'active',
    trustScore: input.source.trustScore,
    priority: input.source.priority,
    isPrimary: input.isPrimary ?? !input.record.duplicateEventId,
    isActive: true,
    rawMetadata: {
      ...metadata,
      sourceType: input.source.sourceType,
      platform,
      role,
      canonicalUrl,
      eventUrl: input.candidate.eventUrl,
      ticketUrl,
      checkoutProviderId: readMetadataString(metadata, 'checkoutProviderId'),
      syncStatus: input.syncStatus ?? 'active',
      isPrimary: input.isPrimary ?? !input.record.duplicateEventId,
    },
  };
}

export class EventOriginService {
  constructor(private readonly sourceReferences: EventSourceReferenceRepository) {}

  async upsertFromPublish(input: UpsertEventOriginInput): Promise<EventOrigin> {
    const origin = buildEventOriginFromPublish(input);
    const existing = await this.sourceReferences.findByExternalEventId(
      origin.sourceId,
      origin.externalId,
    );

    await this.sourceReferences.upsert({
      id: `ref-${origin.eventId}-${origin.sourceId}-${origin.externalId}`,
      canonicalEventId: origin.eventId,
      sourceId: origin.sourceId,
      externalEventId: origin.externalId,
      originalUrl: origin.canonicalUrl ?? origin.eventUrl,
      rawRecordId: input.record.id,
      importJobId: input.record.importJobId,
      firstSeenAt: existing?.firstSeenAt ?? origin.firstSeenAt,
      lastSeenAt: origin.lastSeenAt,
      lastChangedAt: existing?.lastChangedAt,
      active: origin.isActive,
      sourcePriority: origin.priority,
      sourceQuality: origin.trustScore,
      metadata: origin.rawMetadata,
    });

    return {
      ...origin,
      firstSeenAt: existing?.firstSeenAt ?? origin.firstSeenAt,
    };
  }

  async listByEventId(eventId: string): Promise<EventOrigin[]> {
    const references = await this.sourceReferences.findByCanonicalEventId(eventId);
    return references.map((reference) =>
      mapSourceReferenceToEventOrigin(
        {
          ...reference,
          id: `origin-${buildOriginStableKey(reference.sourceId, reference.externalEventId)}`,
          canonicalEventId: eventId,
        },
        {
          sourceType: readMetadataString(reference.metadata, 'sourceType'),
          platform: readMetadataString(reference.metadata, 'platform'),
          role: readMetadataString(reference.metadata, 'role') as EventOrigin['role'],
          canonicalUrl: readMetadataString(reference.metadata, 'canonicalUrl'),
          eventUrl: readMetadataString(reference.metadata, 'eventUrl'),
          ticketUrl: readMetadataString(reference.metadata, 'ticketUrl'),
          organizerExternalId: readMetadataString(reference.metadata, 'organizerExternalId'),
          checkoutProviderId: readMetadataString(reference.metadata, 'checkoutProviderId'),
          syncStatus: readMetadataString(reference.metadata, 'syncStatus') as EventOrigin['syncStatus'],
          isPrimary: reference.metadata?.isPrimary === true,
          rawMetadata: reference.metadata,
        },
      ),
    );
  }

  async markOriginStale(sourceId: string, externalId: string): Promise<void> {
    await this.sourceReferences.markInactive(sourceId, externalId);
  }
}
