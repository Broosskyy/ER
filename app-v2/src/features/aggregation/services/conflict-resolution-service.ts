import type { ImportAuditLogRepository } from '@/data/repositories/import-admin-repository';
import type { AdminEventRepository, EventRepository } from '@/data/repositories/repositories';
import type { AdminEventRecord } from '@/data/types/records';
import type { EventConflict, FieldProvenance } from '@/features/aggregation/merge/event-conflict';
import type {
  EventConflictRepository,
  FieldProvenanceRepository,
} from '@/features/aggregation/repositories/multi-source-repositories';
import type { EventQualityResolver } from '@/features/events/quality/event-quality-resolver';
import type { PublishReadinessResolver } from '@/features/events/quality/publish-readiness-resolver';
import type { Event } from '@/features/events/types/event';
import { invalidateConsumerEventCaches } from '@/features/events/formatting/consumer-cache-invalidation';

export type ConflictResolutionDecision =
  | 'source_value'
  | 'keep_canonical'
  | 'manual_value'
  | 'defer';

export interface ResolveConflictRequest {
  conflictId: string;
  decision: ConflictResolutionDecision;
  actorId: string;
  sourceId?: string;
  manualValue?: unknown;
}

export interface ResolveConflictResult {
  conflict: EventConflict;
  fieldProvenance?: FieldProvenance;
  event: Event;
  qualityScore: number;
  publishReadiness: 'ready' | 'needs_review' | 'blocked';
}

function adminRecordToEvent(record: AdminEventRecord): Event {
  return {
    id: record.id,
    slug: record.id,
    title: record.title,
    description: record.description,
    imageUrl: record.imageUrl,
    startDateTime: record.startDate,
    endDateTime: record.endDate,
    timezone: 'Europe/Berlin',
    venue: record.venueName ?? 'TBA',
    city: record.venueCity ?? 'Köln',
    country: 'Germany',
    genres: [],
    artists: [],
    organizer: record.organizerName,
    ticketUrl: record.ticketUrl,
    source: record.sourceId ?? 'admin',
    sourceEventId: record.id,
    status: record.status === 'published' ? 'published' : 'draft',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function applyFieldToAdminRecord(
  record: AdminEventRecord,
  field: string,
  value: unknown,
): AdminEventRecord {
  const next = { ...record, updatedAt: new Date().toISOString() };
  switch (field) {
    case 'description':
      next.description = String(value ?? '');
      break;
    case 'ticketUrl':
      next.ticketUrl = value ? String(value) : undefined;
      break;
    case 'imageUrl':
      next.imageUrl = value ? String(value) : undefined;
      break;
    case 'organizerName':
      next.organizerName = value ? String(value) : undefined;
      break;
    case 'venueAddress':
    case 'venueName':
      next.venueName = value ? String(value) : next.venueName;
      break;
    default:
      break;
  }
  return next;
}

export class ConflictResolutionService {
  constructor(
    private readonly adminEvents: AdminEventRepository,
    private readonly eventRepository: EventRepository,
    private readonly conflicts: EventConflictRepository,
    private readonly fieldProvenance: FieldProvenanceRepository,
    private readonly qualityResolver: EventQualityResolver,
    private readonly publishReadinessResolver: PublishReadinessResolver,
    private readonly auditRepository: ImportAuditLogRepository,
  ) {}

  async resolve(request: ResolveConflictRequest): Promise<ResolveConflictResult> {
    const conflict = await this.conflicts.findById(request.conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${request.conflictId} not found.`);
    }

    if (request.decision === 'defer') {
      await this.auditRepository.create({
        actorId: request.actorId,
        action: 'conflict_deferred',
        entityType: 'event_conflict',
        entityId: conflict.id,
        summary: `Deferred conflict on ${conflict.field}`,
      });
      const adminRecord = await this.loadAdminRecord(conflict.canonicalEventId);
      const allConflicts = await this.conflicts.findByCanonicalEventId(conflict.canonicalEventId);
      const event = adminRecordToEvent(adminRecord);
      const quality = this.qualityResolver.resolve(event, { conflicts: allConflicts });
      const readiness = this.publishReadinessResolver.resolve(event, { conflicts: allConflicts });
      return {
        conflict,
        event,
        qualityScore: quality.score,
        publishReadiness: readiness.status,
      };
    }

    if (conflict.resolved && conflict.resolution === request.decision) {
      return this.buildResult(conflict);
    }

    this.validateDecision(conflict, request);

    const adminRecord = await this.loadAdminRecord(conflict.canonicalEventId);
    const currentEvent = adminRecordToEvent(adminRecord);
    const currentValue = this.readFieldValue(currentEvent, conflict.field);
    const chosenValue = this.resolveChosenValue(conflict, request, currentValue);

    let provenance: FieldProvenance | undefined;
    const now = new Date().toISOString();
    if (request.decision === 'manual_value') {
      provenance = await this.fieldProvenance.setManualOverride(
        conflict.canonicalEventId,
        conflict.field,
        chosenValue,
        now,
      );
    } else {
      provenance = await this.fieldProvenance.upsertFieldSelection({
        id: `provenance-${conflict.canonicalEventId}-${conflict.field}`,
        canonicalEventId: conflict.canonicalEventId,
        fieldPath: conflict.field,
        value: chosenValue,
        selectedSourceId: request.decision === 'source_value' ? request.sourceId ?? 'unknown' : 'canonical',
        selectionReason: request.decision,
        alternatives: conflict.values.filter((entry) => entry.sourceId !== request.sourceId),
        lastChangedAt: now,
      });
    }

    const updatedRecord = applyFieldToAdminRecord(adminRecord, conflict.field, chosenValue);
    const savedRecord = await this.adminEvents.save(updatedRecord);
    await this.conflicts.resolve(conflict.id, request.decision, now);

    const resolvedConflict: EventConflict = {
      ...conflict,
      resolved: true,
      resolution: request.decision,
      resolvedAt: now,
    };

    await this.auditRepository.create({
      actorId: request.actorId,
      action: 'conflict_resolved',
      entityType: 'event_conflict',
      entityId: conflict.id,
      summary: `${request.decision} on ${conflict.field}`,
    });

    await invalidateConsumerEventCaches(this.eventRepository);
    return this.buildResult(resolvedConflict, provenance, savedRecord);
  }

  async reopen(conflictId: string, actorId: string): Promise<ResolveConflictResult> {
    const conflict = await this.conflicts.findById(conflictId);
    if (!conflict) {
      throw new Error(`Conflict ${conflictId} not found.`);
    }
    await this.conflicts.reopen(conflictId);
    await this.auditRepository.create({
      actorId,
      action: 'conflict_reopened',
      entityType: 'event_conflict',
      entityId: conflictId,
      summary: `Reopened conflict on ${conflict.field}`,
    });
    const reopened: EventConflict = {
      ...conflict,
      resolved: false,
      resolution: undefined,
      resolvedAt: undefined,
    };
    await invalidateConsumerEventCaches(this.eventRepository);
    return this.buildResult(reopened);
  }

  private validateDecision(conflict: EventConflict, request: ResolveConflictRequest): void {
    if (request.decision === 'source_value') {
      if (!request.sourceId) {
        throw new Error('source_value requires sourceId.');
      }
      const hasSource = conflict.values.some((entry) => entry.sourceId === request.sourceId);
      if (!hasSource) {
        throw new Error(`Source ${request.sourceId} is not part of this conflict.`);
      }
    }
    if (request.decision === 'manual_value' && request.manualValue === undefined) {
      throw new Error('manual_value requires manualValue.');
    }
  }

  private resolveChosenValue(
    conflict: EventConflict,
    request: ResolveConflictRequest,
    currentValue: unknown,
  ): unknown {
    if (request.decision === 'keep_canonical') {
      return currentValue;
    }
    if (request.decision === 'manual_value') {
      return request.manualValue;
    }
    if (request.decision === 'source_value') {
      return conflict.values.find((entry) => entry.sourceId === request.sourceId)?.value;
    }
    return currentValue;
  }

  private readFieldValue(event: Event, field: string): unknown {
    switch (field) {
      case 'description':
        return event.description;
      case 'ticketUrl':
        return event.ticketUrl;
      case 'imageUrl':
        return event.imageUrl;
      case 'organizerName':
        return event.organizer;
      case 'venueAddress':
      case 'venueName':
        return event.venue;
      case 'artistNames':
        return event.artists;
      case 'latitude':
        return event.latitude;
      case 'longitude':
        return event.longitude;
      default:
        return undefined;
    }
  }

  private async loadAdminRecord(canonicalEventId: string): Promise<AdminEventRecord> {
    const record = await this.adminEvents.getById(canonicalEventId);
    if (!record) {
      throw new Error(`Canonical event ${canonicalEventId} not found.`);
    }
    return record;
  }

  private async buildResult(
    conflict: EventConflict,
    provenance?: FieldProvenance,
    adminRecord?: AdminEventRecord,
  ): Promise<ResolveConflictResult> {
    const record = adminRecord ?? await this.loadAdminRecord(conflict.canonicalEventId);
    const allConflicts = await this.conflicts.findByCanonicalEventId(conflict.canonicalEventId);
    const event = adminRecordToEvent(record);
    const quality = this.qualityResolver.resolve(event, { conflicts: allConflicts });
    const readiness = this.publishReadinessResolver.resolve(event, { conflicts: allConflicts });
    return {
      conflict,
      fieldProvenance: provenance,
      event,
      qualityScore: quality.score,
      publishReadiness: readiness.status,
    };
  }
}
