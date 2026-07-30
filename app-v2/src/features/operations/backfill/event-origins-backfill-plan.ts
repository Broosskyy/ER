import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import { buildEventOriginFromPublish } from '@/features/events/services/event-origin-service';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';
import type { ImportRecordRepository } from '@/data/repositories/import-repositories';

export const PRODUCTION_ORIGIN_SOURCE_IDS = [
  'source-bootshaus-koeln',
  'source-affenkaefig',
  'source-bootshaus-ticket-io',
  'source-affenkaefig-ticket-kings',
] as const;

export interface OriginBackfillPlanItem {
  canonicalEventId: string;
  sourceId: string;
  externalEventId: string;
  action: 'insert' | 'update' | 'skip';
  role?: string;
  platform?: string;
  isPrimary?: boolean;
  reason?: string;
}

export interface OriginBackfillPlanReport {
  generatedAt: string;
  eventsExamined: number;
  importRecordsExamined: number;
  plannedInserts: number;
  plannedUpdates: number;
  skipped: number;
  missingSourceIds: string[];
  missingExternalIds: string[];
  possibleDuplicateKeys: string[];
  conflictingPrimaryOrigins: string[];
  missingCanonicalUrls: string[];
  missingTicketUrls: string[];
  invalidMetadata: string[];
  items: OriginBackfillPlanItem[];
}

export async function buildOriginBackfillPlan(input: {
  eventRepository: { list: (params: { page: number; pageSize: number }) => Promise<{ items: AdminEventRecord[]; total: number }> };
  sourceRepository: { getAll: () => Promise<SourceRecord[]> };
  sourceReferences: EventSourceReferenceRepository;
  importRecordRepository: ImportRecordRepository;
  pageSize?: number;
}): Promise<OriginBackfillPlanReport> {
  const pageSize = input.pageSize ?? 100;
  const sources = await input.sourceRepository.getAll();
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const items: OriginBackfillPlanItem[] = [];
  const missingSourceIds = new Set<string>();
  const missingExternalIds = new Set<string>();
  const possibleDuplicateKeys = new Set<string>();
  const conflictingPrimaryOrigins = new Set<string>();
  const missingCanonicalUrls = new Set<string>();
  const missingTicketUrls = new Set<string>();
  const invalidMetadata = new Set<string>();
  let importRecordsExamined = 0;
  let eventsExamined = 0;

  const firstPage = await input.eventRepository.list({ page: 1, pageSize });
  const totalPages = Math.ceil(firstPage.total / pageSize);

  for (let page = 1; page <= totalPages; page += 1) {
    const { items: events } =
      page === 1 ? firstPage : await input.eventRepository.list({ page, pageSize });

    for (const event of events) {
      eventsExamined += 1;
      if (!event.sourceId) {
        continue;
      }
      const source = sourceById.get(event.sourceId);
      if (!source) {
        missingSourceIds.add(event.sourceId);
        continue;
      }

      const canonicalEventId = event.canonicalEventId ?? event.id;
      const references = await input.sourceReferences.findByCanonicalEventId(canonicalEventId);
      const targetReferences =
        references.length > 0
          ? references
          : [
              {
                sourceId: source.id,
                externalEventId: event.id,
                originalUrl: event.websiteUrl,
                firstSeenAt: event.createdAt,
                lastSeenAt: event.createdAt,
                active: event.status !== 'archived',
                sourcePriority: source.priority,
                sourceQuality: source.trustScore,
              },
            ];

      const primaryCandidates = targetReferences.filter(
        (reference) => reference.sourceId === event.sourceId,
      );
      if (primaryCandidates.length > 1) {
        conflictingPrimaryOrigins.add(canonicalEventId);
      }

      for (const reference of targetReferences) {
        const key = `${reference.sourceId}:${reference.externalEventId}`;
        if (items.some((entry) => `${entry.sourceId}:${entry.externalEventId}` === key)) {
          possibleDuplicateKeys.add(key);
        }

        const refSource = sourceById.get(reference.sourceId);
        if (!refSource) {
          missingSourceIds.add(reference.sourceId);
          continue;
        }
        if (!reference.externalEventId) {
          missingExternalIds.add(canonicalEventId);
          continue;
        }

        const record = await input.importRecordRepository.findLatestBySourceAndExternalId(
          reference.sourceId,
          reference.externalEventId,
        );
        if (record) {
          importRecordsExamined += 1;
        }

        const origin = buildEventOriginFromPublish({
          canonicalEventId,
          source: refSource,
          record:
            record ??
            ({
              id: `backfill-plan-${canonicalEventId}-${reference.sourceId}`,
              sourceId: reference.sourceId,
              externalId: reference.externalEventId,
              sourceUrl: reference.originalUrl ?? event.websiteUrl ?? '',
              originalUrl: reference.originalUrl,
              status: 'imported',
              createdAt: reference.firstSeenAt,
              retrievedAt: reference.firstSeenAt,
              resultingEventId: event.id,
            } as ImportRecord),
          candidate: record
            ? {
                ...getEffectiveCandidate(record),
                sourceId: refSource.id,
                sourceName: refSource.displayName,
                externalId: reference.externalEventId,
              }
            : {
                title: event.title,
                description: event.description,
                startDate: event.startDate,
                endDate: event.endDate,
                timezone: event.timezone,
                venueName: event.venueName,
                cityName: event.venueCity,
                organizerName: event.organizerName,
                ticketUrl: event.ticketUrl,
                eventUrl: event.websiteUrl,
                imageUrl: event.imageUrl,
                sourceId: refSource.id,
                sourceName: refSource.displayName,
                externalId: reference.externalEventId,
              },
          isPrimary: reference.sourceId === event.sourceId,
        });

        if (!origin.canonicalUrl && !origin.eventUrl) {
          missingCanonicalUrls.add(key);
        }
        if (origin.role === 'ticketing' && !origin.ticketUrl) {
          missingTicketUrls.add(key);
        }
        if (origin.rawMetadata && typeof origin.rawMetadata !== 'object') {
          invalidMetadata.add(key);
        }

        const existingMetadata = reference.metadata ?? {};
        const action =
          existingMetadata.role && existingMetadata.platform && existingMetadata.backfilledAt
            ? 'skip'
            : existingMetadata.role
              ? 'update'
              : 'insert';

        items.push({
          canonicalEventId,
          sourceId: reference.sourceId,
          externalEventId: reference.externalEventId,
          action,
          role: origin.role,
          platform: origin.platform,
          isPrimary: origin.isPrimary,
          reason: action === 'skip' ? 'already_backfilled' : undefined,
        });
      }
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    eventsExamined,
    importRecordsExamined,
    plannedInserts: items.filter((item) => item.action === 'insert').length,
    plannedUpdates: items.filter((item) => item.action === 'update').length,
    skipped: items.filter((item) => item.action === 'skip').length,
    missingSourceIds: [...missingSourceIds],
    missingExternalIds: [...missingExternalIds],
    possibleDuplicateKeys: [...possibleDuplicateKeys],
    conflictingPrimaryOrigins: [...conflictingPrimaryOrigins],
    missingCanonicalUrls: [...missingCanonicalUrls],
    missingTicketUrls: [...missingTicketUrls],
    invalidMetadata: [...invalidMetadata],
    items,
  };
}
