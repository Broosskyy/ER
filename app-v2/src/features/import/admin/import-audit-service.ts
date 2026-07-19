import type { CreateImportAuditLogInput, ImportAuditLog } from '@/features/import/models/types';
import type { ImportAuditLogRepository } from '@/data/repositories/import-admin-repository';

export class ImportAuditService {
  constructor(private readonly auditRepository: ImportAuditLogRepository) {}

  async log(input: CreateImportAuditLogInput): Promise<ImportAuditLog> {
    return this.auditRepository.create(input);
  }

  async logSourceCreated(actorId: string, sourceId: string, sourceName: string): Promise<void> {
    await this.log({
      actorId,
      action: 'source_created',
      entityType: 'source',
      entityId: sourceId,
      summary: `Source "${sourceName}" created.`,
    });
  }

  async logSourceUpdated(actorId: string, sourceId: string, summary: string): Promise<void> {
    await this.log({
      actorId,
      action: 'source_updated',
      entityType: 'source',
      entityId: sourceId,
      summary,
    });
  }

  async logSourceActivated(actorId: string, sourceId: string): Promise<void> {
    await this.log({
      actorId,
      action: 'source_activated',
      entityType: 'source',
      entityId: sourceId,
      summary: 'Source activated.',
    });
  }

  async logSourceDeactivated(actorId: string, sourceId: string): Promise<void> {
    await this.log({
      actorId,
      action: 'source_deactivated',
      entityType: 'source',
      entityId: sourceId,
      summary: 'Source deactivated.',
    });
  }

  async logSourceTested(actorId: string, sourceId: string, result: string): Promise<void> {
    await this.log({
      actorId,
      action: 'source_tested',
      entityType: 'source',
      entityId: sourceId,
      summary: `Source test: ${result}`,
    });
  }

  async logImportStarted(actorId: string, sourceId: string, jobId: string): Promise<void> {
    await this.log({
      actorId,
      action: 'import_started',
      entityType: 'import_job',
      entityId: jobId,
      summary: `Manual import started for source ${sourceId}.`,
    });
  }

  async logRecordEdited(actorId: string, recordId: string): Promise<void> {
    await this.log({
      actorId,
      action: 'record_edited',
      entityType: 'import_record',
      entityId: recordId,
      summary: 'Import record normalized fields updated.',
    });
  }

  async logRecordApproved(actorId: string, recordId: string, eventId: string): Promise<void> {
    await this.log({
      actorId,
      action: 'record_approved',
      entityType: 'import_record',
      entityId: recordId,
      summary: `Record approved. Event ${eventId} created as draft.`,
    });
  }

  async logRecordRejected(actorId: string, recordId: string, reason: string): Promise<void> {
    await this.log({
      actorId,
      action: 'record_rejected',
      entityType: 'import_record',
      entityId: recordId,
      summary: `Record rejected: ${reason}`,
    });
  }

  async logRecordDuplicate(actorId: string, recordId: string, eventId: string): Promise<void> {
    await this.log({
      actorId,
      action: 'record_duplicate',
      entityType: 'import_record',
      entityId: recordId,
      summary: `Marked as duplicate of event ${eventId}.`,
    });
  }
}
