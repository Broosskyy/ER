import type { AdminEventRecord } from '@/data/types/records';
import type { AdminEventRepository, EventRepository } from '@/data/repositories/repositories';
import { EntityResolutionWritebackService } from '@/features/entity-resolution/entity-resolution-writeback-service';
import { touchesEntityResolutionEdits } from '@/features/entity-resolution/entity-resolution-writeback';
import {
  publishLifecycleDomainEvent,
  type RealDataDomainEventBus,
} from '@/features/events/domain/real-data-domain-events';
import { matchingConfig } from '@/features/import/matching/matching-config';
import { loadMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { ImportMatchingService } from '@/features/import/matching/import-matching-service';
import {
  ImportConcurrencyError,
  ImportError,
  ImportPermissionError,
} from '@/features/import/errors/import-errors';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import type { RejectReason } from '@/features/import/models/statuses';
import type { ImportRecord, ReviewerEdits } from '@/features/import/models/types';
import { ImportCandidateValidator } from '@/features/import/validation/import-candidate-validator';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { ImportAdminRepository } from '@/data/repositories/import-admin-repository';
import type { ImportRecordRepository } from '@/data/repositories/import-repositories';
import type { AuthSession } from '@/services/supabase/auth-service';
import {
  assertPermission,
  resolveAdminRole,
  type AdminRole,
} from '@/features/import/admin/admin-roles';
import {
  canApproveRecord,
  getEffectiveCandidate,
  isReviewableStatus,
  mergeReviewerEdits,
} from '@/features/import/admin/import-utils';
import { ImportAuditService } from './import-audit-service';

import { buildAdminEventFromImportRecord } from '@/features/import/services/import-event-publish-service';

export class ImportReviewService {
  private readonly validator = new ImportCandidateValidator();

  constructor(
    private readonly recordRepository: ImportRecordRepository,
    private readonly adminRepository: ImportAdminRepository,
    private readonly adminEventRepository: AdminEventRepository,
    private readonly auditService: ImportAuditService,
    private readonly lineupService: {
      replaceFromMatchedArtistIds(
        role: AdminRole,
        eventId: string,
        matchedArtistIds: string[],
      ): Promise<unknown>;
    },
    private readonly consumerEventRepository?: EventRepository,
    private readonly matchingService: ImportMatchingService = new ImportMatchingService(),
    private readonly catalogLoader: typeof loadMatchingCatalog = loadMatchingCatalog,
    private readonly entityResolutionWritebackService?: EntityResolutionWritebackService,
    private readonly domainEventBus?: RealDataDomainEventBus,
    private readonly sourceReferences?: EventSourceReferenceRepository,
  ) {}

  private role(session: AuthSession | null): AdminRole | null {
    return resolveAdminRole(session);
  }

  private actorId(session: AuthSession): string {
    return session.user.id;
  }

  private async persistEntityResolutionWriteback(
    session: AuthSession,
    record: ImportRecord,
    trigger: 'edit' | 'approve',
    edits?: ReviewerEdits,
  ): Promise<void> {
    if (!this.entityResolutionWritebackService) {
      return;
    }

    const candidate = getEffectiveCandidate(
      edits ? { ...record, reviewerEdits: edits } : record,
    );

    try {
      const result = await this.entityResolutionWritebackService.persist({
        record,
        candidate,
        actorId: this.actorId(session),
        trigger,
        edits,
      });

      if (result.auditEntries.length > 0) {
        await this.auditService.logEntityResolutionWriteback(
          this.actorId(session),
          record.id,
          result.auditEntries,
        );
      }
    } catch (error: unknown) {
      throw new ImportError(
        'Entity resolution decisions could not be persisted. Review was not completed.',
        'IMPORT_ENTITY_RESOLUTION_PERSIST_FAILED',
        error,
      );
    }
  }

  async getRecord(session: AuthSession | null, recordId: string): Promise<ImportRecord | null> {
    assertPermission(this.role(session), 'records:read');
    return this.recordRepository.getById(recordId);
  }

  async editRecord(
    session: AuthSession,
    recordId: string,
    edits: ReviewerEdits,
    expectedUpdatedAt: string,
  ): Promise<ImportRecord> {
    assertPermission(this.role(session), 'records:edit');
    const record = await this.recordRepository.getById(recordId);
    if (!record) {
      throw new ImportError('Import record not found.', 'IMPORT_UNKNOWN');
    }
    if (!isReviewableStatus(record.status) && record.status !== 'needs_review') {
      throw new ImportError('Record cannot be edited in its current status.', 'IMPORT_RECORD_NOT_REVIEWABLE');
    }

    const mergedEdits = mergeReviewerEdits(record, edits);
    const candidate = getEffectiveCandidate({ ...record, reviewerEdits: mergedEdits });
    const validation = this.validator.validate(candidate);
    if (validation.errors.length > 0) {
      throw new ImportError(
        validation.errors.map((e) => e.message).join(' '),
        'IMPORT_VALIDATION_BLOCKED',
      );
    }

    if (touchesEntityResolutionEdits(edits)) {
      await this.persistEntityResolutionWriteback(session, record, 'edit', mergedEdits);
    }

    const updated = await this.adminRepository.updateIfUnchanged(
      {
        ...record,
        reviewerEdits: mergedEdits,
        validationWarnings: validation.warnings,
        validationErrors: validation.errors,
      },
      expectedUpdatedAt,
    );

    await this.auditService.logRecordEdited(this.actorId(session), recordId);
    return updated;
  }

  async approveRecord(
    session: AuthSession,
    recordId: string,
    expectedUpdatedAt: string,
  ): Promise<{ record: ImportRecord; event: AdminEventRecord }> {
    assertPermission(this.role(session), 'records:approve');
    const record = await this.recordRepository.getById(recordId);
    if (!record) {
      throw new ImportError('Import record not found.', 'IMPORT_UNKNOWN');
    }
    if (record.updatedAt !== expectedUpdatedAt) {
      throw new ImportConcurrencyError();
    }
    if (!canApproveRecord(record)) {
      if (
        record.duplicateScore !== undefined &&
        record.duplicateScore >= matchingConfig.duplicateThreshold &&
        record.duplicateDecision !== 'dismissed'
      ) {
        throw new ImportError(
          'Duplicate decision required before approval.',
          'IMPORT_DUPLICATE_UNRESOLVED',
        );
      }
      throw new ImportError('Record cannot be approved.', 'IMPORT_RECORD_NOT_REVIEWABLE');
    }

    const candidate = getEffectiveCandidate(record);
    const validation = this.validator.validate(candidate);
    if (validation.errors.length > 0) {
      throw new ImportError(
        'Record contains blocking validation errors.',
        'IMPORT_VALIDATION_BLOCKED',
      );
    }

    const catalog = await this.catalogLoader();
    const { result: matchResult } = this.matchingService.match(
      candidate as NormalizedEventCandidate,
      catalog,
    );
    if (
      matchResult.duplicateScore >= matchingConfig.duplicateThreshold &&
      record.duplicateDecision !== 'dismissed'
    ) {
      throw new ImportError(
        'Duplicate check failed. Confirm or dismiss duplicate first.',
        'IMPORT_DUPLICATE_UNRESOLVED',
      );
    }

    await this.persistEntityResolutionWriteback(session, record, 'approve');

    const event = buildAdminEventFromImportRecord(record);
    const matchedArtistIds = [
      ...new Set(
        (record.reviewerEdits?.matchedArtistIds ?? record.matchedArtistIds ?? []).filter(Boolean),
      ),
    ];
    let savedEvent: AdminEventRecord;
    try {
      savedEvent = await this.adminEventRepository.save(event);
      if (this.sourceReferences) {
        const now = new Date().toISOString();
        await this.sourceReferences.upsert({
          id: `ref-${savedEvent.id}-${record.sourceId}-${record.externalId}`,
          canonicalEventId: savedEvent.id,
          sourceId: record.sourceId,
          externalEventId: record.externalId,
          originalUrl: record.originalUrl ?? record.sourceUrl,
          rawRecordId: record.id,
          importJobId: record.importJobId,
          firstSeenAt: record.retrievedAt ?? record.createdAt,
          lastSeenAt: now,
          active: true,
          sourcePriority: 50,
        });
      }
      const role = this.role(session);
      if (role && matchedArtistIds.length > 0) {
        await this.lineupService.replaceFromMatchedArtistIds(
          role,
          savedEvent.id,
          matchedArtistIds,
        );
        savedEvent = (await this.adminEventRepository.getById(savedEvent.id)) ?? savedEvent;
      }
    } catch (error: unknown) {
      throw new ImportError(
        'Event could not be created.',
        'IMPORT_EVENT_CREATE_FAILED',
        error,
      );
    }

    const now = new Date().toISOString();
    const updated = await this.adminRepository.updateIfUnchanged(
      {
        ...record,
        status: 'imported',
        resultingEventId: savedEvent.id,
        reviewedBy: this.actorId(session),
        reviewedAt: now,
        validationWarnings: validation.warnings,
        validationErrors: [],
      },
      expectedUpdatedAt,
    );

    await this.auditService.logRecordApproved(this.actorId(session), recordId, savedEvent.id);
    if (this.domainEventBus) {
      publishLifecycleDomainEvent(this.domainEventBus, {
        type: 'event_created',
        canonicalEventId: savedEvent.id,
        sourceId: record.sourceId,
        payload: {
          importRecordId: recordId,
          venueId: savedEvent.venueId,
          organizerId: savedEvent.organizerId,
        },
      });
    }
    if (this.consumerEventRepository) {
      await this.consumerEventRepository.refresh();
    }
    return { record: updated, event: savedEvent };
  }

  async rejectRecord(
    session: AuthSession,
    recordId: string,
    reason: RejectReason,
    note: string | undefined,
    expectedUpdatedAt: string,
  ): Promise<ImportRecord> {
    assertPermission(this.role(session), 'records:reject');
    const record = await this.recordRepository.getById(recordId);
    if (!record) {
      throw new ImportError('Import record not found.', 'IMPORT_UNKNOWN');
    }

    const now = new Date().toISOString();
    const updated = await this.adminRepository.updateIfUnchanged(
      {
        ...record,
        status: 'rejected',
        rejectReason: reason,
        rejectNote: note,
        reviewedBy: this.actorId(session),
        reviewedAt: now,
      },
      expectedUpdatedAt,
    );

    await this.auditService.logRecordRejected(this.actorId(session), recordId, reason);
    return updated;
  }

  async confirmDuplicate(
    session: AuthSession,
    recordId: string,
    duplicateEventId: string,
    expectedUpdatedAt: string,
  ): Promise<ImportRecord> {
    assertPermission(this.role(session), 'records:duplicate');
    const record = await this.recordRepository.getById(recordId);
    if (!record) {
      throw new ImportError('Import record not found.', 'IMPORT_UNKNOWN');
    }

    const now = new Date().toISOString();
    const updated = await this.adminRepository.updateIfUnchanged(
      {
        ...record,
        status: 'duplicate',
        duplicateEventId,
        duplicateDecision: 'confirmed',
        reviewedBy: this.actorId(session),
        reviewedAt: now,
      },
      expectedUpdatedAt,
    );

    await this.auditService.logRecordDuplicate(this.actorId(session), recordId, duplicateEventId);
    return updated;
  }

  async dismissDuplicate(
    session: AuthSession,
    recordId: string,
    expectedUpdatedAt: string,
  ): Promise<ImportRecord> {
    assertPermission(this.role(session), 'records:duplicate');
    const record = await this.recordRepository.getById(recordId);
    if (!record) {
      throw new ImportError('Import record not found.', 'IMPORT_UNKNOWN');
    }

    const updated = await this.adminRepository.updateIfUnchanged(
      {
        ...record,
        status: 'needs_review',
        duplicateDecision: 'dismissed',
        duplicateScore: 0,
      },
      expectedUpdatedAt,
    );

    await this.auditService.logRecordEdited(this.actorId(session), recordId);
    return updated;
  }

  async overrideDuplicate(
    session: AuthSession,
    recordId: string,
    duplicateEventId: string,
    expectedUpdatedAt: string,
  ): Promise<ImportRecord> {
    assertPermission(this.role(session), 'records:duplicate');
    const record = await this.recordRepository.getById(recordId);
    if (!record) {
      throw new ImportError('Import record not found.', 'IMPORT_UNKNOWN');
    }

    const updated = await this.adminRepository.updateIfUnchanged(
      {
        ...record,
        duplicateEventId,
        duplicateDecision: 'override',
        status: 'needs_review',
      },
      expectedUpdatedAt,
    );

    await this.auditService.logRecordEdited(this.actorId(session), recordId);
    return updated;
  }
}
