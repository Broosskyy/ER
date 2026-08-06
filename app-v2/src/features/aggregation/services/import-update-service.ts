import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import type { ImportRecord } from '@/features/import/models/types';
import type { SourceRecord } from '@/data/types/records';
import { recordCandidateEquivalent } from '@/features/import/services/import-record-identity';
import { resolveSourcePublishBehavior } from '@/features/import/domain/publish-behavior';
import {
  isRepairablePlaceholderText,
  resolveFillOnlyText,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-repair';
import { isTicketIoPlaceholderDescription } from '@/features/aggregation/connectors/ticket-platform/ticket-io-field-quality';
import {
  buildImportPublishFieldPatch,
  mergeImportPublishFields,
} from '@/features/import/services/import-event-field-mapper';

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
  'priceText',
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
  fillOnly?: boolean;
}

function resolvePrimaryDescriptionUpdate(
  existing: string | undefined,
  incoming: string | undefined,
): string {
  if (incoming?.trim() && !isTicketIoPlaceholderDescription(incoming)) {
    return incoming;
  }
  return existing ?? '';
}

export class ImportUpdateService {
  detectChanges(
    candidate: CanonicalImportEvent,
    existingEvent?: AdminEventRecord | null,
    options: { cancelled?: boolean; existingRecord?: ImportRecord | null; fillOnly?: boolean } = {},
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
    const fillOnly = options.fillOnly ?? false;

    const previewPatch = buildImportPublishFieldPatch(candidate, {
      existing: existingEvent,
      fillOnly,
    });

    if ((existingEvent.title ?? '') !== (candidate.title ?? '')) {
      changedFields.push('title');
    }

    if (fillOnly) {
      const nextDescription = resolveFillOnlyText(existingEvent.description, candidate.description) ?? '';
      if ((existingEvent.description ?? '') !== nextDescription) {
        changedFields.push('description');
      }
    } else if (
      (existingEvent.description ?? '') !== resolvePrimaryDescriptionUpdate(existingEvent.description, candidate.description)
    ) {
      changedFields.push('description');
    }

    if (normalizeComparableInstant(existingEvent.startDate) !== normalizeComparableInstant(candidate.startDate)) {
      changedFields.push('startDate');
    }
    if (normalizeComparableInstant(existingEvent.endDate) !== normalizeComparableInstant(candidate.endDate)) {
      changedFields.push('endDate');
    }
    if ((existingEvent.ticketUrl ?? '') !== (previewPatch.ticketUrl ?? existingEvent.ticketUrl ?? '')) {
      changedFields.push('ticketUrl');
    }
    if ((existingEvent.priceText ?? '') !== (previewPatch.priceText ?? existingEvent.priceText ?? '')) {
      if (previewPatch.priceText?.trim() || isRepairablePlaceholderText(existingEvent.priceText)) {
        changedFields.push('priceText');
      }
    }
    if (fillOnly) {
      const nextVenue = resolveFillOnlyText(existingEvent.venueName, candidate.venueName) ?? '';
      if ((existingEvent.venueName ?? '') !== nextVenue) {
        changedFields.push('venueName');
      }
      const nextOrganizer = resolveFillOnlyText(existingEvent.organizerName, candidate.organizerName) ?? '';
      if ((existingEvent.organizerName ?? '') !== nextOrganizer) {
        changedFields.push('organizerName');
      }
    } else {
      if ((existingEvent.venueName ?? '') !== (candidate.venueName ?? '')) {
        changedFields.push('venueName');
      }
      if ((existingEvent.organizerName ?? '') !== (candidate.organizerName ?? '')) {
        changedFields.push('organizerName');
      }
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
    const merged = mergeImportPublishFields({
      existing,
      candidate,
      fillOnly: false,
    });
    return {
      ...merged,
      sourceId,
      updatedAt: new Date().toISOString(),
    };
  }

  /** Fill-only update for ticket platform enrichment — never overwrites official source fields. */
  buildEnrichmentAdminEvent(
    existing: AdminEventRecord,
    candidate: CanonicalImportEvent,
  ): AdminEventRecord {
    return mergeImportPublishFields({
      existing,
      candidate,
      fillOnly: true,
    });
  }

  /** @deprecated Use resolveSourcePublishBehavior / isEnrichmentPublish instead. */
  isTicketPlatformEnrichmentSource(sourceType?: string): boolean {
    return sourceType === 'ticket_platform';
  }

  isEnrichmentSource(
    source: Pick<SourceRecord, 'sourceType' | 'publishMode' | 'sourceConfig' | 'sourceRoles' | 'category'>,
  ): boolean {
    return resolveSourcePublishBehavior(source) === 'enrichment';
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
