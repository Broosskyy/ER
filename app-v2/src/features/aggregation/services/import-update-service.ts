import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import type { ImportRecord } from '@/features/import/models/types';

export const IMPORT_CHANGE_FIELDS = [
  'description',
  'startDate',
  'endDate',
  'venueName',
  'ticketUrl',
  'artistNames',
  'status',
] as const;

export type ImportChangeField = (typeof IMPORT_CHANGE_FIELDS)[number];

export type ImportChangeType = 'created' | 'updated' | 'cancelled' | 'unchanged';

export interface ImportChangeSet {
  changeType: ImportChangeType;
  changedFields: ImportChangeField[];
}

export interface ImportUpdateContext {
  sourceId: string;
  externalId: string;
  candidate: CanonicalImportEvent;
  existingRecord?: ImportRecord | null;
  existingEvent?: AdminEventRecord | null;
  cancelled?: boolean;
}

export class ImportUpdateService {
  detectChanges(
    candidate: CanonicalImportEvent,
    existingEvent?: AdminEventRecord | null,
    options: { cancelled?: boolean } = {},
  ): ImportChangeSet {
    if (options.cancelled) {
      return { changeType: 'cancelled', changedFields: ['status'] };
    }

    if (!existingEvent) {
      return { changeType: 'created', changedFields: [] };
    }

    const changedFields: ImportChangeField[] = [];

    if ((existingEvent.description ?? '') !== (candidate.description ?? '')) {
      changedFields.push('description');
    }
    if (existingEvent.startDate !== candidate.startDate) {
      changedFields.push('startDate');
    }
    if ((existingEvent.endDate ?? '') !== (candidate.endDate ?? '')) {
      changedFields.push('endDate');
    }
    if ((existingEvent.ticketUrl ?? '') !== (candidate.ticketUrl ?? '')) {
      changedFields.push('ticketUrl');
    }

    if (changedFields.length === 0) {
      return { changeType: 'unchanged', changedFields: [] };
    }

    return { changeType: 'updated', changedFields };
  }

  resolveArchiveStatus(existingEvent?: AdminEventRecord | null): AdminEventRecord['status'] {
    if (!existingEvent) {
      return 'archived';
    }
    return existingEvent.status === 'published' ? 'archived' : 'archived';
  }

  buildUpdatedAdminEvent(
    existing: AdminEventRecord,
    candidate: CanonicalImportEvent,
    sourceId: string,
  ): AdminEventRecord {
    return {
      ...existing,
      title: candidate.title,
      subtitle: candidate.subtitle ?? existing.subtitle,
      description: candidate.description ?? existing.description,
      startDate: candidate.startDate,
      endDate: candidate.endDate,
      ticketUrl: candidate.ticketUrl ?? existing.ticketUrl,
      imageUrl: candidate.imageUrl ?? existing.imageUrl,
      websiteUrl: candidate.originalLink ?? candidate.eventUrl ?? existing.websiteUrl,
      sourceId,
      updatedAt: new Date().toISOString(),
    };
  }

  findMissingExternalIds(
    previousExternalIds: string[],
    currentExternalIds: string[],
  ): string[] {
    const current = new Set(currentExternalIds);
    return previousExternalIds.filter((externalId) => !current.has(externalId));
  }
}

export const importUpdateService = new ImportUpdateService();
