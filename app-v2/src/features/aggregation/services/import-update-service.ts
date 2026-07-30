import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import type { ImportRecord } from '@/features/import/models/types';
import { recordCandidateEquivalent } from '@/features/import/services/import-record-identity';

function normalizeComparableInstant(value: string | undefined): string {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toISOString();
}

export const IMPORT_CHANGE_FIELDS = [
  'title',
  'description',
  'startDate',
  'endDate',
  'venueName',
  'ticketUrl',
  'artistNames',
  'organizerName',
  'imageUrl',
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
    options: { cancelled?: boolean; existingRecord?: ImportRecord | null } = {},
  ): ImportChangeSet {
    if (options.cancelled) {
      return { changeType: 'cancelled', changedFields: ['status'] };
    }

    if (!existingEvent) {
      if (options.existingRecord) {
        if (recordCandidateEquivalent(options.existingRecord, candidate)) {
          return { changeType: 'unchanged', changedFields: [] };
        }
        return { changeType: 'updated', changedFields: ['description', 'startDate', 'venueName'] };
      }
      return { changeType: 'created', changedFields: [] };
    }

    const changedFields: ImportChangeField[] = [];

    if ((existingEvent.title ?? '') !== (candidate.title ?? '')) {
      changedFields.push('title');
    }
    if ((existingEvent.description ?? '') !== (candidate.description ?? '')) {
      changedFields.push('description');
    }
    if (normalizeComparableInstant(existingEvent.startDate) !== normalizeComparableInstant(candidate.startDate)) {
      changedFields.push('startDate');
    }
    if (normalizeComparableInstant(existingEvent.endDate) !== normalizeComparableInstant(candidate.endDate)) {
      changedFields.push('endDate');
    }
    if ((existingEvent.ticketUrl ?? '') !== (candidate.ticketUrl ?? '')) {
      changedFields.push('ticketUrl');
    }
    if ((existingEvent.venueName ?? '') !== (candidate.venueName ?? '')) {
      changedFields.push('venueName');
    }
    if ((existingEvent.organizerName ?? '') !== (candidate.organizerName ?? '')) {
      changedFields.push('organizerName');
    }
    if ((existingEvent.imageUrl ?? '') !== (candidate.imageUrl ?? '')) {
      changedFields.push('imageUrl');
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

  /** Fill-only update for ticket platform enrichment — never overwrites official source fields. */
  buildEnrichmentAdminEvent(
    existing: AdminEventRecord,
    candidate: CanonicalImportEvent,
  ): AdminEventRecord {
    return {
      ...existing,
      ticketUrl: candidate.ticketUrl ?? existing.ticketUrl,
      imageUrl: existing.imageUrl ? existing.imageUrl : candidate.imageUrl,
      updatedAt: new Date().toISOString(),
    };
  }

  isTicketPlatformEnrichmentSource(sourceType?: string): boolean {
    return sourceType === 'ticket_platform';
  }

  findMissingExternalIds(
    previousExternalIds: string[],
    currentExternalIds: string[],
  ): string[] {
    const current = new Set(currentExternalIds);
    return previousExternalIds.filter((externalId) => !current.has(externalId));
  }

  detectStartDateConflict(
    existingStartDate: string,
    candidateStartDate: string,
  ): boolean {
    return existingStartDate !== candidateStartDate;
  }

  protectManualOverrides<T extends Record<string, unknown>>(
    existing: T,
    incoming: Partial<T>,
    protectedFields: readonly (keyof T)[],
    manualOverrides: Partial<Record<keyof T, boolean>> = {},
  ): Partial<T> {
    const next: Partial<T> = { ...incoming };
    for (const field of protectedFields) {
      if (manualOverrides[field]) {
        delete next[field];
      }
    }
    return next;
  }
}

export const importUpdateService = new ImportUpdateService();
