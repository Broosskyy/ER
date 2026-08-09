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
import type { EventOriginService } from '@/features/events/services/event-origin-service';
import { featureFlags } from '@/core/config/feature-flags';
import {
  isEnrichmentPublish,
  resolveSourcePublishBehavior,
} from '@/features/import/domain/publish-behavior';
import {
  fieldTrustMergeService,
  FieldTrustMergeService,
} from '@/features/import/services/field-trust-merge-service';

import { writeImportPublishLineup } from '@/features/import/services/import-publish-lineup-writer';
import type { ImportPublishLineupResult } from '@/features/import/services/import-publish-lineup-writer';
import { needsLineupProjectionRepair, baselineExistingArtistIdsForRepair } from '@/features/import/services/import-lineup-projection-repair';
import type { EventLineupService } from '@/features/events/services/event-lineup-service';
import { loadMatchingCatalog } from '@/features/import/matching/matching-catalog';
import type { AdminArtistRepository } from '@/data/repositories/repositories';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';
import {
  applyImportPublishFieldPatch,
  buildAdminEventFromImportFields,
} from '@/features/import/services/import-event-field-mapper';
import {
  evaluateGenericTruthPublish,
  extractApplicableGenericTruthPatch,
  readCandidateEvidenceVerifiedAt,
  shouldApplyGenericTruthPublish,
} from '@/features/import/generic-truth-pipeline';
import { resolveServerGenericTruthRollout } from '@/features/import/generic-truth-pipeline/server-rollout-config';

export function buildAdminEventFromImportRecord(
  record: ImportRecord,
  existingEventId?: string,
  existing?: AdminEventRecord | null,
): AdminEventRecord {
  return buildAdminEventFromImportFields({
    record,
    existingEventId,
    existing,
  });
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

    private readonly eventOriginService?: EventOriginService,

    private readonly lineupService?: Pick<
      EventLineupService,
      | 'replaceFromImportPipeline'
      | 'getLineupArtistIds'
      | 'replaceStructuredLineupFromImport'
      | 'getStructuredLineupForEvent'
    >,

    private readonly adminArtistRepository?: Pick<AdminArtistRepository, 'getAll' | 'save'>,

  ) {}



  async resolveExistingEventId(

    record: ImportRecord,

    previousRecords: ImportRecord[],

    candidate?: CanonicalImportEvent,

    source?: SourceRecord,

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



    if (
      candidate &&
      this.canonicalIdentityService &&
      source &&
      isEnrichmentPublish(source, true)
    ) {
      const ticketUrl = candidate.ticketUrl ?? record.externalId;
      const catalog = await loadMatchingCatalog();
      const byTicketUrl = this.canonicalIdentityService.resolveByTicketIoEventUrl(
        ticketUrl,
        catalog.events,
      );
      if (byTicketUrl) {
        return byTicketUrl;
      }
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

      source,

    );

    const existingEvent = existingEventId

      ? await this.adminEventRepository.getById(existingEventId)

      : null;

    const publishBehavior = resolveSourcePublishBehavior(source);
    const isEnrichment = isEnrichmentPublish(source, Boolean(existingEvent));

    let eventPayload: AdminEventRecord;
    let mergeDecisions: ReturnType<FieldTrustMergeService['mergeAdminEvent']>['decisions'] = [];

    if (featureFlags.genericSourceFieldTrustMerge) {
      const provenanceByField =
        existingEvent && this.fieldProvenanceWriter
          ? await this.fieldProvenanceWriter.loadProvenanceByField(
              existingEvent.canonicalEventId ?? existingEvent.id,
            )
          : undefined;
      const mergeResult = fieldTrustMergeService.mergeAdminEvent({
        existing: existingEvent,
        candidate: canonicalCandidate,
        source,
        behavior: publishBehavior,
        provenanceByField: provenanceByField?.size ? provenanceByField : undefined,
      });
      eventPayload = existingEvent
        ? mergeResult.event
        : buildAdminEventFromImportRecord(record, existingEventId, existingEvent);
      mergeDecisions = mergeResult.decisions;
    } else if (existingEvent) {
      eventPayload = isEnrichment
        ? importUpdateService.buildEnrichmentAdminEvent(existingEvent, canonicalCandidate)
        : importUpdateService.buildUpdatedAdminEvent(existingEvent, canonicalCandidate, source.id);
    } else {
      eventPayload = buildAdminEventFromImportRecord(record, existingEventId);
    }



    const now = new Date().toISOString();
    const normalizedPayload = record.normalizedPayload as Record<string, unknown> | undefined;

    let stampedEvent = applyEventPublishLifecycle(eventPayload, {
      existing: existingEvent,
      normalizedPayload,
      publishedAt: now,
    });

    const rollout = resolveServerGenericTruthRollout();
    if (rollout.enabled && existingEvent) {
      const manualLocks =
        this.fieldProvenanceWriter
          ? await this.loadPublishManualLocks(existingEvent.canonicalEventId ?? existingEvent.id)
          : undefined;
      const genericTruthEvaluation = evaluateGenericTruthPublish({
        existing: existingEvent,
        candidate: canonicalCandidate,
        rollout,
        fillOnly: isEnrichment,
        allowedFieldGroups: rollout.fieldGroups.length > 0 ? rollout.fieldGroups : undefined,
        manualLocks,
      });
      if (shouldApplyGenericTruthPublish(genericTruthEvaluation, rollout)) {
        const truthPatch = extractApplicableGenericTruthPatch(
          genericTruthEvaluation,
          rollout.fieldGroups,
        );
        if (Object.keys(truthPatch).length > 0) {
          stampedEvent = applyImportPublishFieldPatch(stampedEvent, truthPatch);
        }
      }
    }

    let savedEvent = await this.adminEventRepository.save({
      ...stampedEvent,
      status: 'published',
      sourceId: isEnrichment ? (existingEvent?.sourceId ?? source.id) : source.id,
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
            sourceId: isEnrichment ? (existingEvent?.sourceId ?? source.id) : source.id,
            updatedAt: lifecycleEvent.updatedAt,
            createdAt: savedEvent.createdAt,
          });
        }
      } catch {
        // Event is already persisted; lifecycle side-effects must not fail auto-publish.
      }
    }



    if (!options.skipProvenance) {

      if (this.eventOriginService) {
        await this.eventOriginService.upsertFromPublish({
          canonicalEventId: savedEvent.canonicalEventId ?? savedEvent.id,
          source,
          record,
          candidate: canonicalCandidate,
          isPrimary: !isEnrichment,
        });
      } else {
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
      }



      if (this.fieldProvenanceWriter) {

        await this.fieldProvenanceWriter.writeFromPublish(
          savedEvent.canonicalEventId ?? savedEvent.id,
          source,
          savedEvent,
          {
            publishedAt: now,
            evidenceVerifiedAt: readCandidateEvidenceVerifiedAt(canonicalCandidate),
            originExternalId: record.externalId,
            confidence: FieldTrustMergeService.confidenceFromCandidate(canonicalCandidate),
            mergeDecisions,
          },
        );

      }



      if (this.canonicalIdentityService && !isEnrichment) {

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



    await this.writeLineupForRecord(updatedRecord, savedEvent.id);



    return {

      record: updatedRecord,

      event: savedEvent,

      created: !existingEvent,

    };

  }

  async repairLineupProjection(
    record: ImportRecord,
    eventId: string,
  ): Promise<ImportPublishLineupResult> {
    return this.writeLineupForRecord(record, eventId);
  }

  async repairLineupProjectionIfNeeded(
    record: ImportRecord,
    eventId: string,
  ): Promise<ImportPublishLineupResult> {
    const existingIds = this.lineupService
      ? await this.lineupService.getLineupArtistIds(eventId)
      : [];
    if (!this.adminArtistRepository) {
      if (existingIds.length > 0) {
        return {
          wroteLineup: false,
          artistIds: [],
          completeness: 'none',
          source: 'structured',
          createdArtistIds: [],
          titleDerivedNames: [],
        };
      }
      return this.repairLineupProjection(record, eventId);
    }

    const artists = await this.adminArtistRepository.getAll();
    const artistsById = new Map(artists.map((artist) => [artist.id, artist] as const));
    if (!needsLineupProjectionRepair(record, existingIds, artistsById)) {
      return {
        wroteLineup: false,
        artistIds: [],
        completeness: 'none',
        source: 'structured',
        createdArtistIds: [],
        titleDerivedNames: [],
      };
    }
    return this.repairLineupProjection(record, eventId);
  }

  private async writeLineupForRecord(
    record: ImportRecord,
    eventId: string,
  ): Promise<ImportPublishLineupResult> {
    const event = await this.adminEventRepository.getById(eventId);
    return writeImportPublishLineup({
      lineupService: this.lineupService,
      record,
      eventId,
      eventTitle: event?.title,
      eventTicketUrl: event?.ticketUrl,
      eventWebsiteUrl: event?.websiteUrl,
      catalog: this.adminArtistRepository ? await loadMatchingCatalog() : undefined,
      allArtists: this.adminArtistRepository ? await this.adminArtistRepository.getAll() : undefined,
      saveArtist: this.adminArtistRepository
        ? (artist) => this.adminArtistRepository!.save(artist)
        : undefined,
    });
  }



  async refreshConsumerFeed(): Promise<void> {
    await invalidateConsumerEventCaches(this.consumerEventRepository);
  }

  private async loadPublishManualLocks(canonicalEventId: string): Promise<Set<string> | undefined> {
    if (!this.fieldProvenanceWriter) {
      return undefined;
    }
    const provenanceByField = await this.fieldProvenanceWriter.loadProvenanceByField(canonicalEventId);
    const locks = new Set<string>();
    for (const [field, provenance] of provenanceByField.entries()) {
      if (provenance.selectedSourceId === 'manual_override') {
        locks.add(field);
      }
    }
    return locks.size > 0 ? locks : undefined;
  }
}


