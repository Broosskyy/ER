import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import { blockingKeyDuplicateCandidateGenerator } from '@/features/aggregation/duplicate/duplicate-candidate-generator';
import type { AdminEventRepository } from '@/data/repositories/repositories';
import type { EventBlockingKeyRepository } from '@/features/multi-source-matching/domain/matching-types';
import type { EventLifecycleHistoryRepository } from '@/features/event-lifecycle/domain/lifecycle-engine-types';
import type { EventLifecycleEngine } from '@/features/event-lifecycle/services/event-lifecycle-engine';
import type { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import type { SourceIntelligenceService } from '../services/source-intelligence-service';
import type { BackfillHandler } from './backfill-runner';

function toCanonicalImportEvent(event: AdminEventRecord): CanonicalImportEvent {
  return {
    externalId: event.id,
    sourceId: event.sourceId ?? 'unknown',
    sourceName: event.sourceId ?? 'unknown',
    rawSourceType: 'unknown',
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
    originalLink: event.websiteUrl,
  };
}

export function createBlockingKeysBackfillHandler(
  eventRepository: AdminEventRepository,
  blockingKeyRepository: EventBlockingKeyRepository,
): BackfillHandler {
  return {
    backfillType: 'blocking_keys',
    async processBatch(job, batchSize) {
      const cursor = job.cursorValue ? Number(job.cursorValue) : 0;
      const page = Math.floor(cursor / batchSize) + 1;
      const { items } = await eventRepository.list({ page, pageSize: batchSize });

      let processed = 0;
      let errors = 0;
      for (const event of items) {
        try {
          const candidate = blockingKeyDuplicateCandidateGenerator.createCandidate(
            event.id,
            toCanonicalImportEvent(event),
          );
          await blockingKeyRepository.indexKeys(event.id, candidate.blockingKeys);
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

export function createLifecycleHistoryBackfillHandler(
  eventRepository: AdminEventRepository,
  lifecycleEngine: EventLifecycleEngine,
  lifecycleHistoryRepository: EventLifecycleHistoryRepository,
): BackfillHandler {
  return {
    backfillType: 'lifecycle_history',
    async processBatch(job, batchSize) {
      const cursor = job.cursorValue ? Number(job.cursorValue) : 0;
      const page = Math.floor(cursor / batchSize) + 1;
      const { items } = await eventRepository.list({ page, pageSize: batchSize });

      let processed = 0;
      let errors = 0;
      for (const event of items) {
        try {
          const existing = await lifecycleHistoryRepository.listByCanonicalEventId(event.id, 1);
          if (existing.length > 0) {
            continue;
          }

          await lifecycleEngine.process({
            before: null,
            after: event,
            context: {
              sourceId: event.sourceId,
              confidenceScore: 100,
              cancelled: Boolean(event.cancelledAt),
              postponed: Boolean(event.postponedAt),
            },
          });
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

export function createProvenanceBackfillHandler(
  eventRepository: AdminEventRepository,
  sourceReferences: EventSourceReferenceRepository,
  provenanceWriter: EventFieldProvenanceWriter,
): BackfillHandler {
  return {
    backfillType: 'provenance',
    async processBatch(job, batchSize) {
      const cursor = job.cursorValue ? Number(job.cursorValue) : 0;
      const page = Math.floor(cursor / batchSize) + 1;
      const { items } = await eventRepository.list({ page, pageSize: batchSize });
      const now = new Date().toISOString();

      let processed = 0;
      let errors = 0;
      for (const event of items) {
        if (!event.sourceId) {
          continue;
        }
        try {
          const canonicalEventId = event.canonicalEventId ?? event.id;
          const externalEventId = event.id;
          const existing = await sourceReferences.findByExternalEventId(
            event.sourceId,
            externalEventId,
          );

          if (!existing) {
            await sourceReferences.upsert({
              id: `ref-${canonicalEventId}-${event.sourceId}-${externalEventId}`,
              canonicalEventId,
              sourceId: event.sourceId,
              externalEventId,
              originalUrl: event.websiteUrl,
              firstSeenAt: event.createdAt ?? now,
              lastSeenAt: now,
              active: event.status !== 'archived',
              sourcePriority: 50,
            });
          } else {
            await sourceReferences.updateLastSeen(event.sourceId, externalEventId, now);
          }

          await provenanceWriter.writeFromPublishBySourceId(
            canonicalEventId,
            event.sourceId,
            event,
            event.publishedAt ?? now,
          );
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

export function createSourceIntelligenceBackfillHandler(
  sourceIntelligenceService: SourceIntelligenceService,
): BackfillHandler {
  return {
    backfillType: 'source_intelligence',
    async processBatch(job, batchSize) {
      const snapshots = await sourceIntelligenceService.computeForAllSources(batchSize);
      const cursor = job.cursorValue ? Number(job.cursorValue) : 0;
      return {
        processed: snapshots.length,
        errors: 0,
        nextCursor: String(cursor + snapshots.length),
        completed: snapshots.length < batchSize,
      };
    },
  };
}
