import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import { buildEventOriginFromPublish } from '@/features/events/services/event-origin-service';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecordRepository } from '@/data/repositories/import-repositories';
import type { ImportRecord } from '@/features/import/models/types';
import type { RawSourceType } from '@/features/import/models/normalized-event-candidate';
import type { BackfillHandler } from './backfill-runner';

export function createEventOriginsBackfillHandler(
  eventRepository: { list: (params: { page: number; pageSize: number }) => Promise<{ items: AdminEventRecord[] }> },
  sourceRepository: { getAll: () => Promise<SourceRecord[]> },
  sourceReferences: EventSourceReferenceRepository,
  importRecordRepository: ImportRecordRepository,
): BackfillHandler {
  return {
    backfillType: 'event_origins',
    async processBatch(job, batchSize) {
      const cursor = job.cursorValue ? Number(job.cursorValue) : 0;
      const page = Math.floor(cursor / batchSize) + 1;
      const [{ items }, sources] = await Promise.all([
        eventRepository.list({ page, pageSize: batchSize }),
        sourceRepository.getAll(),
      ]);
      const sourceById = new Map(sources.map((source) => [source.id, source]));
      const now = new Date().toISOString();

      let processed = 0;
      let errors = 0;

      for (const event of items) {
        if (!event.sourceId) {
          continue;
        }
        const source = sourceById.get(event.sourceId);
        if (!source) {
          continue;
        }
        try {
          const canonicalEventId = event.canonicalEventId ?? event.id;
          const references = await sourceReferences.findByCanonicalEventId(canonicalEventId);
          const targetReferences =
            references.length > 0
              ? references
              : [
                  {
                    sourceId: source.id,
                    externalEventId: event.id,
                    canonicalEventId,
                    originalUrl: event.websiteUrl,
                    firstSeenAt: event.createdAt,
                    lastSeenAt: now,
                    active: event.status !== 'archived',
                    sourcePriority: source.priority,
                    sourceQuality: source.trustScore,
                  },
                ];

          for (const reference of targetReferences) {
            const refSource = sourceById.get(reference.sourceId) ?? source;
            const record = await importRecordRepository.findLatestBySourceAndExternalId(
              reference.sourceId,
              reference.externalEventId,
            );
            const candidate = record
              ? getEffectiveCandidate(record)
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
                  rawSourceType: 'unknown' as const satisfies RawSourceType,
                };
            const rawSourceType: RawSourceType = record
              ? getEffectiveCandidate(record).rawSourceType
              : 'unknown';

            const origin = buildEventOriginFromPublish({
              canonicalEventId,
              source: refSource,
              record:
                record ??
                ({
                  id: `backfill-${canonicalEventId}-${reference.sourceId}`,
                  sourceId: reference.sourceId,
                  externalId: reference.externalEventId,
                  sourceUrl: reference.originalUrl ?? event.websiteUrl ?? '',
                  originalUrl: reference.originalUrl,
                  status: 'imported',
                  createdAt: reference.firstSeenAt,
                  retrievedAt: reference.firstSeenAt,
                  resultingEventId: event.id,
                } as ImportRecord),
              candidate: {
                ...candidate,
                sourceId: refSource.id,
                sourceName: refSource.displayName,
                externalId: reference.externalEventId,
                rawSourceType,
              },
              isPrimary: reference.sourceId === event.sourceId,
            });

            const existingMetadata = reference.metadata ?? {};
            if (existingMetadata.role && existingMetadata.platform && existingMetadata.backfilledAt) {
              continue;
            }

            await sourceReferences.upsert({
              id: `ref-${canonicalEventId}-${reference.sourceId}-${reference.externalEventId}`,
              canonicalEventId,
              sourceId: reference.sourceId,
              externalEventId: reference.externalEventId,
              originalUrl: origin.canonicalUrl ?? reference.originalUrl,
              rawRecordId: reference.rawRecordId ?? record?.id,
              importJobId: reference.importJobId ?? record?.importJobId,
              firstSeenAt: reference.firstSeenAt,
              lastSeenAt: now,
              lastChangedAt: reference.lastChangedAt,
              active: reference.active,
              sourcePriority: reference.sourcePriority,
              sourceQuality: reference.sourceQuality,
              metadata: {
                ...existingMetadata,
                ...origin.rawMetadata,
                backfilledAt: now,
                backfillJobId: job.id,
              },
            });
          }
          processed += 1;
        } catch {
          errors += 1;
        }
      }

      const nextCursor = String(cursor + items.length);
      return {
        processed,
        errors,
        nextCursor: items.length < batchSize ? undefined : nextCursor,
        completed: items.length < batchSize,
      };
    },
  };
}
