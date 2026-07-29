import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

import type { AdminEventRecord, SourceRecord } from '@/data/types/records';

import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';

import type { AdminEventRepository, EventRepository } from '@/data/repositories/repositories';

import type { ImportRecord } from '@/features/import/models/types';

import { importUpdateService } from '@/features/aggregation/services/import-update-service';

import { getEffectiveCandidate } from '@/features/import/admin/import-utils';

import type { ImportRecordRepository } from '@/data/repositories/import-repositories';

import { applyEventPublishLifecycle } from '@/features/import/services/event-publish-lifecycle';

import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';

import { EventCanonicalIdentityService } from '@/features/events/services/event-canonical-identity-service';
import type { EventLifecycleOrchestrator } from '@/features/event-lifecycle/services/event-lifecycle-orchestrator';



function createEventId(): string {

  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

}



export function buildAdminEventFromImportRecord(

  record: ImportRecord,

  existingEventId?: string,

): AdminEventRecord {

  const candidate = getEffectiveCandidate(record);

  const now = new Date().toISOString();

  const organizerId = record.reviewerEdits?.matchedOrganizerId ?? record.matchedOrganizerId;

  const normalized = record.normalizedPayload as Record<string, unknown> | undefined;



  return {

    id: existingEventId ?? createEventId(),

    title: candidate.title,

    subtitle: typeof normalized?.subtitle === 'string' ? normalized.subtitle : undefined,

    description: candidate.description ?? '',

    cityId: record.reviewerEdits?.matchedCityId ?? record.matchedCityId,

    venueId: record.reviewerEdits?.matchedVenueId ?? record.matchedVenueId,

    organizerId,

    organizerName: candidate.organizerName,

    artistId: undefined,

    genreId: (record.reviewerEdits?.matchedGenreIds ?? record.matchedGenreIds)?.[0],

    sourceId: record.sourceId,

    startDate: candidate.startDate,

    endDate: candidate.endDate,

    ticketUrl: candidate.ticketUrl,

    imageUrl: candidate.imageUrl,

    websiteUrl: candidate.eventUrl ?? record.originalUrl,

    venueName: candidate.venueName,

    venueCity: candidate.cityName,

    timezone: candidate.timezone,

    status: 'published',

    createdAt: existingEventId ? now : now,

    updatedAt: now,

  };

}



export interface PublishImportRecordOptions {

  actorId?: string;

  skipProvenance?: boolean;

}



export interface PublishImportRecordResult {

  record: ImportRecord;

  event: AdminEventRecord;

  created: boolean;

}



export class ImportEventPublishService {

  constructor(

    private readonly recordRepository: ImportRecordRepository,

    private readonly adminEventRepository: AdminEventRepository,

    private readonly sourceReferences: EventSourceReferenceRepository,

    private readonly consumerEventRepository?: EventRepository,

    private readonly fieldProvenanceWriter?: EventFieldProvenanceWriter,

    private readonly canonicalIdentityService?: EventCanonicalIdentityService,

    private readonly lifecycleOrchestrator?: EventLifecycleOrchestrator,

  ) {}



  async resolveExistingEventId(

    record: ImportRecord,

    previousRecords: ImportRecord[],

    candidate?: CanonicalImportEvent,

  ): Promise<string | undefined> {

    if (record.resultingEventId) {

      return record.resultingEventId;

    }

    if (record.duplicateEventId) {

      return record.duplicateEventId;

    }



    const prior = previousRecords.find(

      (entry) =>

        entry.sourceId === record.sourceId &&

        entry.externalId === record.externalId &&

        entry.resultingEventId,

    );

    if (prior?.resultingEventId) {

      return prior.resultingEventId;

    }



    const reference = await this.sourceReferences.findByExternalEventId(

      record.sourceId,

      record.externalId,

    );

    if (reference?.canonicalEventId) {

      return reference.canonicalEventId;

    }



    if (candidate && this.canonicalIdentityService) {

      return this.canonicalIdentityService.resolveByFingerprint(candidate);

    }



    return undefined;

  }



  async publishRecord(

    record: ImportRecord,

    source: SourceRecord,

    previousRecords: ImportRecord[] = [],

    options: PublishImportRecordOptions = {},

  ): Promise<PublishImportRecordResult> {

    const candidate = getEffectiveCandidate(record);

    const canonicalCandidate: CanonicalImportEvent = {

      ...candidate,

      sourceId: record.sourceId,

      sourceName: record.sourceName ?? source.displayName,

      externalId: record.externalId,

    };



    const existingEventId = await this.resolveExistingEventId(

      record,

      previousRecords,

      canonicalCandidate,

    );

    const existingEvent = existingEventId

      ? await this.adminEventRepository.getById(existingEventId)

      : null;



    const eventPayload = existingEvent

      ? importUpdateService.buildUpdatedAdminEvent(existingEvent, canonicalCandidate, source.id)

      : buildAdminEventFromImportRecord(record, existingEventId);



    const now = new Date().toISOString();
    const normalizedPayload = record.normalizedPayload as Record<string, unknown> | undefined;

    const stampedEvent = applyEventPublishLifecycle(eventPayload, {
      existing: existingEvent,
      normalizedPayload,
      publishedAt: now,
    });

    let savedEvent = await this.adminEventRepository.save({
      ...stampedEvent,
      status: 'published',
      sourceId: source.id,
      updatedAt: now,
      createdAt: existingEvent?.createdAt ?? stampedEvent.createdAt,
    });

    if (this.lifecycleOrchestrator) {
      try {
        const lifecycleEvent = await this.lifecycleOrchestrator.processImportPublish({
          before: existingEvent,
          after: savedEvent,
          candidate: canonicalCandidate,
          source,
          record,
          cancelled: normalizedPayload?.isCancelled === true || normalizedPayload?.cancelled === true,
          postponed: normalizedPayload?.isPostponed === true || normalizedPayload?.postponed === true,
        });
        if (lifecycleEvent.updatedAt !== savedEvent.updatedAt || lifecycleEvent.status !== savedEvent.status) {
          savedEvent = await this.adminEventRepository.save({
            ...lifecycleEvent,
            status: 'published',
            sourceId: source.id,
            updatedAt: lifecycleEvent.updatedAt,
            createdAt: savedEvent.createdAt,
          });
        }
      } catch {
        // Event is already persisted; lifecycle side-effects must not fail auto-publish.
      }
    }



    if (!options.skipProvenance) {

      await this.sourceReferences.upsert({

        id: `ref-${savedEvent.id}-${source.id}-${record.externalId}`,

        canonicalEventId: savedEvent.canonicalEventId ?? savedEvent.id,

        sourceId: source.id,

        externalEventId: record.externalId,

        originalUrl: record.originalUrl ?? record.sourceUrl,

        rawRecordId: record.id,

        importJobId: record.importJobId,

        firstSeenAt: record.retrievedAt ?? record.createdAt,

        lastSeenAt: now,

        active: true,

        sourcePriority: source.priority,

        sourceQuality: source.trustScore,

      });



      if (this.fieldProvenanceWriter) {

        await this.fieldProvenanceWriter.writeFromPublish(

          savedEvent.canonicalEventId ?? savedEvent.id,

          source.id,

          savedEvent,

          now,

        );

      }



      if (this.canonicalIdentityService) {

        await this.canonicalIdentityService.registerIdentity(

          savedEvent.canonicalEventId ?? savedEvent.id,

          canonicalCandidate,

          source.id,

        );

      }

    }



    const updatedRecord = await this.recordRepository.update({

      ...record,

      status: 'imported',

      resultingEventId: savedEvent.id,

      reviewedBy: options.actorId,

      reviewedAt: now,

      validationErrors: [],

    });



    return {

      record: updatedRecord,

      event: savedEvent,

      created: !existingEvent,

    };

  }



  async refreshConsumerFeed(): Promise<void> {

    if (this.consumerEventRepository) {

      await this.consumerEventRepository.refresh();

    }

  }

}


