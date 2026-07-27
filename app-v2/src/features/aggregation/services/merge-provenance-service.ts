import type { ImportAuditLogRepository } from '@/data/repositories/import-admin-repository';
import type { AdminEventRepository, EventRepository } from '@/data/repositories/repositories';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type {
  EventConflict,
  EventConflictSeverity,
  FieldProvenance,
} from '@/features/aggregation/merge/event-conflict';
import { detectConflictingValues } from '@/features/aggregation/merge/event-conflict';
import type { MergeStrategy, MergedImportEvent } from '@/features/aggregation/merge/merge-strategy';
import type {
  EventConflictRepository,
  EventSourceReferenceRepository,
  FieldProvenanceRepository,
} from '@/features/aggregation/repositories/multi-source-repositories';
import type { EventQualityResolver } from '@/features/events/quality/event-quality-resolver';
import type { PublishReadinessResolver } from '@/features/events/quality/publish-readiness-resolver';
import type { Event } from '@/features/events/types/event';

export interface MergeContribution {
  sourceId: string;
  sourceName: string;
  externalEventId: string;
  sourceType?: string;
  sourcePriority: number;
  sourceTrustScore: number;
  sourceQualityScore?: number;
  sourceHealthScore?: number;
  event: CanonicalImportEvent;
  originalUrl?: string;
  rawRecordId?: string;
  importJobId?: string;
  retrievedAt: string;
}

export interface MergeProvenanceRequest {
  canonicalEventId: string;
  contributions: MergeContribution[];
  actorId?: string;
}

export interface MergeProvenanceResult {
  canonicalEventId: string;
  adminRecord: AdminEventRecord;
  event: Event;
  fieldProvenance: FieldProvenance[];
  conflicts: EventConflict[];
  qualityScore: number;
  publishReadiness: 'ready' | 'needs_review' | 'blocked';
}

const TRACKED_FIELDS = [
  'description',
  'venueAddress',
  'latitude',
  'longitude',
  'organizerName',
  'artistNames',
  'ticketUrl',
  'imageUrl',
] as const;

type TrackedField = (typeof TRACKED_FIELDS)[number];

const FIELD_CONFLICT_SEVERITY: Record<TrackedField, EventConflictSeverity> = {
  description: 'warning',
  venueAddress: 'warning',
  latitude: 'warning',
  longitude: 'warning',
  organizerName: 'info',
  artistNames: 'info',
  ticketUrl: 'info',
  imageUrl: 'info',
};

function stableConflictId(canonicalEventId: string, field: string): string {
  return `conflict-${canonicalEventId}-${field}`;
}

function adminRecordToCanonicalImportEvent(record: AdminEventRecord): CanonicalImportEvent {
  return {
    externalId: record.id,
    sourceId: record.sourceId ?? 'canonical',
    sourceName: 'canonical',
    title: record.title,
    description: record.description,
    startDate: record.startDate,
    endDate: record.endDate,
    venueName: record.venueName,
    ticketUrl: record.ticketUrl,
    imageUrl: record.imageUrl,
    organizerName: record.organizerName,
    rawSourceType: 'unknown',
  };
}

function adminRecordToEvent(record: AdminEventRecord, merged?: CanonicalImportEvent): Event {
  const source = merged ?? adminRecordToCanonicalImportEvent(record);
  return {
    id: record.id,
    slug: record.id,
    title: record.title,
    description: source.description ?? record.description,
    imageUrl: source.imageUrl ?? record.imageUrl,
    startDateTime: record.startDate,
    endDateTime: record.endDate,
    timezone: 'Europe/Berlin',
    venue: source.venueName ?? record.venueName ?? 'TBA',
    address: source.venueAddress,
    city: record.venueCity ?? 'Köln',
    country: 'Germany',
    latitude: source.latitude,
    longitude: source.longitude,
    genres: [],
    artists: source.artistNames ?? [],
    lineup: source.artistNames,
    organizer: source.organizerName ?? record.organizerName,
    ticketUrl: source.ticketUrl ?? record.ticketUrl,
    source: record.sourceId ?? 'admin',
    sourceEventId: record.id,
    status: record.status === 'published' ? 'published' : 'draft',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function applyMergedToAdminRecord(
  record: AdminEventRecord,
  merged: CanonicalImportEvent,
): AdminEventRecord {
  return {
    ...record,
    description: merged.description ?? record.description,
    ticketUrl: merged.ticketUrl ?? record.ticketUrl,
    imageUrl: merged.imageUrl ?? record.imageUrl,
    venueName: merged.venueName ?? record.venueName,
    organizerName: merged.organizerName ?? record.organizerName,
    updatedAt: new Date().toISOString(),
  };
}

function collectAlternatives(
  contributions: MergeContribution[],
  field: TrackedField,
  selectedSourceId: string,
  selectedValue: unknown,
): FieldProvenance['alternatives'] {
  const alternatives: FieldProvenance['alternatives'] = [];
  for (const contribution of contributions) {
    const value = contribution.event[field];
    if (value === undefined || value === null || value === '') {
      continue;
    }
    if (contribution.sourceId === selectedSourceId && JSON.stringify(value) === JSON.stringify(selectedValue)) {
      continue;
    }
    alternatives.push({ sourceId: contribution.sourceId, value });
  }
  return alternatives;
}

export class MergeProvenanceService {
  constructor(
    private readonly adminEvents: AdminEventRepository,
    private readonly eventRepository: EventRepository,
    private readonly sourceReferences: EventSourceReferenceRepository,
    private readonly fieldProvenance: FieldProvenanceRepository,
    private readonly conflicts: EventConflictRepository,
    private readonly mergeStrategy: MergeStrategy,
    private readonly qualityResolver: EventQualityResolver,
    private readonly publishReadinessResolver: PublishReadinessResolver,
    private readonly auditRepository: ImportAuditLogRepository,
  ) {}

  async merge(request: MergeProvenanceRequest): Promise<MergeProvenanceResult> {
    const actorId = request.actorId ?? 'system';
    const adminRecord = await this.adminEvents.getById(request.canonicalEventId);
    if (!adminRecord) {
      throw new Error(`Canonical event ${request.canonicalEventId} not found.`);
    }

    const seenKeys = new Set<string>();
    for (const contribution of request.contributions) {
      const key = `${contribution.sourceId}:${contribution.externalEventId}`;
      await this.sourceReferences.upsert({
        id: `ref-${request.canonicalEventId}-${contribution.sourceId}-${contribution.externalEventId}`,
        canonicalEventId: request.canonicalEventId,
        sourceId: contribution.sourceId,
        externalEventId: contribution.externalEventId,
        originalUrl: contribution.originalUrl,
        rawRecordId: contribution.rawRecordId,
        importJobId: contribution.importJobId,
        firstSeenAt: contribution.retrievedAt,
        lastSeenAt: contribution.retrievedAt,
        active: true,
        sourcePriority: contribution.sourcePriority,
        sourceQuality: contribution.sourceQualityScore,
      });
      seenKeys.add(key);
    }

    const existingReferences = await this.sourceReferences.findByCanonicalEventId(request.canonicalEventId);
    for (const reference of existingReferences) {
      const key = `${reference.sourceId}:${reference.externalEventId}`;
      if (!seenKeys.has(key) && reference.active) {
        await this.sourceReferences.markInactive(reference.sourceId, reference.externalEventId);
      }
    }

    const manualOverrides: Record<string, unknown> = {};
    for (const field of TRACKED_FIELDS) {
      const existing = await this.fieldProvenance.findByFieldPath(request.canonicalEventId, field);
      if (existing?.selectedSourceId === 'manual_override') {
        manualOverrides[field] = existing.value;
      }
    }

    let merged: MergedImportEvent | undefined;
    for (const contribution of request.contributions) {
      merged = this.mergeStrategy.merge(contribution.event, merged, {
        sourcePriority: contribution.sourcePriority,
        sourceTrustScore: contribution.sourceTrustScore,
        retrievedAt: contribution.retrievedAt,
        sourceType: contribution.sourceType,
        sourceQualityScore: contribution.sourceQualityScore,
        sourceHealthScore: contribution.sourceHealthScore,
        manualOverrides,
      });
    }

    if (!merged) {
      merged = {
        mergeGroupId: request.canonicalEventId,
        canonicalEvent: adminRecordToCanonicalImportEvent(adminRecord),
        primarySourceId: adminRecord.sourceId ?? 'canonical',
        sourceContributions: [],
        changeHistory: [],
      };
    }

    for (const field of TRACKED_FIELDS) {
      if (manualOverrides[field] !== undefined) {
        merged = {
          ...merged,
          canonicalEvent: {
            ...merged.canonicalEvent,
            [field]: manualOverrides[field],
          } as CanonicalImportEvent,
        };
      }
    }

    const now = new Date().toISOString();
    const persistedProvenance: FieldProvenance[] = [];
    for (const field of TRACKED_FIELDS) {
      const value = merged.canonicalEvent[field];
      const existing = await this.fieldProvenance.findByFieldPath(request.canonicalEventId, field);
      if (existing?.selectedSourceId === 'manual_override') {
        persistedProvenance.push(existing);
        continue;
      }
      const selectedSourceId = this.resolveSelectedSourceId(field, request.contributions, value);
      const provenance: FieldProvenance & { id: string; canonicalEventId: string; fieldPath: string } = {
        id: `provenance-${request.canonicalEventId}-${field}`,
        canonicalEventId: request.canonicalEventId,
        fieldPath: field,
        value,
        selectedSourceId,
        selectionReason: 'field_priority',
        alternatives: collectAlternatives(request.contributions, field, selectedSourceId, value),
        lastChangedAt: now,
      };
      persistedProvenance.push(await this.fieldProvenance.upsertFieldSelection(provenance));
    }

    const existingConflicts = await this.conflicts.findByCanonicalEventId(request.canonicalEventId);
    const persistedConflicts: EventConflict[] = [...existingConflicts];
    for (const field of TRACKED_FIELDS) {
      const values = request.contributions
        .map((contribution) => ({ sourceId: contribution.sourceId, value: contribution.event[field] }))
        .filter((entry) => entry.value !== undefined && entry.value !== null && entry.value !== '');
      const detected = detectConflictingValues(
        request.canonicalEventId,
        field,
        values,
        FIELD_CONFLICT_SEVERITY[field],
        now,
      );
      if (!detected) {
        continue;
      }
      const conflict: EventConflict = {
        ...detected,
        id: stableConflictId(request.canonicalEventId, field),
      };
      const existingConflict = existingConflicts.find((entry) => entry.field === field);
      if (existingConflict) {
        conflict.resolved = existingConflict.resolved;
        conflict.resolution = existingConflict.resolution;
        conflict.resolvedAt = existingConflict.resolvedAt;
      }
      const saved = await this.conflicts.create(conflict);
      const index = persistedConflicts.findIndex((entry) => entry.field === field);
      if (index >= 0) {
        persistedConflicts[index] = saved;
      } else {
        persistedConflicts.push(saved);
      }
    }

    const updatedRecord = applyMergedToAdminRecord(adminRecord, merged.canonicalEvent);
    const savedRecord = await this.adminEvents.save(updatedRecord);
    const event = adminRecordToEvent(savedRecord, merged.canonicalEvent);
    const quality = this.qualityResolver.resolve(event, { conflicts: persistedConflicts });
    const readiness = this.publishReadinessResolver.resolve(event, { conflicts: persistedConflicts });

    await this.auditRepository.create({
      actorId,
      action: 'merge_provenance_applied',
      entityType: 'event',
      entityId: request.canonicalEventId,
      summary: `Merged ${request.contributions.length} source contribution(s) into ${request.canonicalEventId}`,
    });

    await this.eventRepository.refresh();

    return {
      canonicalEventId: request.canonicalEventId,
      adminRecord: savedRecord,
      event,
      fieldProvenance: persistedProvenance,
      conflicts: persistedConflicts,
      qualityScore: quality.score,
      publishReadiness: readiness.status,
    };
  }

  private resolveSelectedSourceId(
    field: TrackedField,
    contributions: MergeContribution[],
    value: unknown,
  ): string {
    const match = contributions.find(
      (contribution) => JSON.stringify(contribution.event[field]) === JSON.stringify(value),
    );
    return match?.sourceId ?? contributions[0]?.sourceId ?? 'canonical';
  }
}
