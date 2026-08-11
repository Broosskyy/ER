import type { ImportAdminRepository } from '@/data/repositories/import-admin-repository';
import type { ImportRecordRepository } from '@/data/repositories/import-repositories';
import { normalizeCanonicalGenreLabels } from '@/features/events/formatting/canonical-genre-normalizer';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

import type { ImportDraft, ReviewTrack } from './import-draft';
import {
  readImportDraftEnvelope,
  replaceImportDraftEnvelope,
  type PersistedDraftDecision,
} from './import-draft-record-mapper';

export type DraftReviewActionType =
  | 'approve'
  | 'batch_approve'
  | 'reject'
  | 'edit'
  | 'merge_into_existing'
  | 'create_new'
  | 'select_duplicate'
  | 'defer';

export interface DraftReviewAction {
  type: DraftReviewActionType;
  draftIds: string[];
  edits?: Record<string, string | string[] | number | undefined>;
  targetEventId?: string;
  note?: string;
  actorId?: string;
}

export interface DraftReviewActionResult {
  accepted: boolean;
  action: DraftReviewAction;
  affectedDraftIds: string[];
  /** Always zero in this phase — dry-run / noop only. */
  databaseWriteOperations: number;
  productionMutations: 0;
  message: string;
}

export interface DraftReviewPersistence {
  apply(action: DraftReviewAction, drafts: ImportDraft[]): Promise<DraftReviewActionResult>;
}

/** Explicit no-write boundary for admin review actions until production apply is approved. */
export class NoopDraftReviewPersistence implements DraftReviewPersistence {
  async apply(
    action: DraftReviewAction,
    drafts: ImportDraft[],
  ): Promise<DraftReviewActionResult> {
    const known = new Set(drafts.map((draft) => draft.id));
    const affectedDraftIds = action.draftIds.filter((id) => known.has(id));
    return {
      accepted: affectedDraftIds.length > 0,
      action,
      affectedDraftIds,
      databaseWriteOperations: 0,
      productionMutations: 0,
      message: `dry_run_noop:${action.type}`,
    };
  }
}

export type ImportRecordDraftReviewMode =
  | 'read_only'
  | 'import_records_only';

function actionFingerprint(action: DraftReviewAction, draftId: string): string {
  return JSON.stringify({
    type: action.type,
    draftId,
    edits: action.edits ?? null,
    targetEventId: action.targetEventId ?? null,
    note: action.note ?? null,
    actorId: action.actorId ?? null,
  });
}

function reviewDecision(type: DraftReviewActionType): PersistedDraftDecision {
  if (
    type === 'approve' ||
    type === 'batch_approve' ||
    type === 'merge_into_existing' ||
    type === 'create_new'
  ) {
    return 'approved';
  }
  if (type === 'reject') return 'rejected';
  if (type === 'defer') return 'deferred';
  return 'pending';
}

function isAllowedForAction(
  action: DraftReviewAction,
  draft: ImportDraft,
): boolean {
  if (action.type === 'batch_approve') {
    return draft.reviewTrack === 'auto_ready';
  }
  if (action.type === 'approve') {
    return draft.reviewTrack !== 'conflict_review';
  }
  return true;
}

function applyDraftEdits(
  draft: ImportDraft,
  edits: DraftReviewAction['edits'],
): ImportDraft {
  if (!edits) return draft;
  const event = draft.proposedCanonicalEvent;
  const editedEvent = event
    ? {
        ...event,
        title:
          typeof edits.title === 'string' ? edits.title : event.title,
        startDate:
          typeof edits.startDate === 'string'
            ? edits.startDate
            : event.startDate,
        venueName:
          typeof edits.venueName === 'string'
            ? edits.venueName
            : event.venueName,
        description:
          typeof edits.description === 'string'
            ? edits.description
            : event.description,
      }
    : event;

  const requestedGenres = Array.isArray(edits.genres)
    ? edits.genres
    : Array.isArray(edits.genreNames)
      ? edits.genreNames
      : undefined;
  if (!requestedGenres) {
    return { ...draft, proposedCanonicalEvent: editedEvent };
  }

  const confirmed = draft.genres.items.filter((item) => item.confirmed);
  const protectedLabels = confirmed.map((item) => item.normalizedLabel);
  const labels = normalizeCanonicalGenreLabels([
    ...protectedLabels,
    ...requestedGenres,
  ]);
  const existingByLabel = new Map(
    draft.genres.items.map((item) => [
      normalizeMatchText(item.normalizedLabel),
      item,
    ]),
  );
  const items = labels.map((label) => {
    const existing = existingByLabel.get(normalizeMatchText(label));
    return (
      existing ?? {
        rawValue: label,
        normalizedLabel: label,
        sourceId: 'admin_review',
        confidence: 'high' as const,
        uncertain: false,
        confirmed: false,
      }
    );
  });

  return {
    ...draft,
    proposedCanonicalEvent: editedEvent
      ? { ...editedEvent, genres: labels }
      : editedEvent,
    genres: {
      ...draft.genres,
      items,
      normalizedLabels: labels,
      rawValues: items.map((item) => item.rawValue),
      uncertainLabels: items
        .filter((item) => item.uncertain)
        .map((item) => item.normalizedLabel),
      chipSuggestions: labels,
      preservedConfirmed:
        draft.genres.preservedConfirmed || confirmed.length > 0,
    },
  };
}

/**
 * Draft-only review mutations. This class can update import_records and
 * import_audit metadata, but has no event repository dependency.
 */
export class ImportRecordDraftReviewPersistence
  implements DraftReviewPersistence
{
  constructor(
    private readonly records: ImportRecordRepository,
    private readonly admin: ImportAdminRepository,
    private readonly mode: ImportRecordDraftReviewMode = 'read_only',
  ) {}

  async apply(
    action: DraftReviewAction,
    drafts: ImportDraft[],
  ): Promise<DraftReviewActionResult> {
    if (this.mode === 'read_only') {
      return {
        accepted: false,
        action,
        affectedDraftIds: [],
        databaseWriteOperations: 0,
        productionMutations: 0,
        message: 'mutation_guard:import_records_read_only',
      };
    }

    const affectedDraftIds: string[] = [];
    let databaseWriteOperations = 0;
    const requested = new Set(action.draftIds);

    for (const draft of drafts) {
      if (
        !requested.has(draft.id) ||
        !draft.persistenceRecordId ||
        !isAllowedForAction(action, draft)
      ) {
        continue;
      }
      const record = await this.records.getById(draft.persistenceRecordId);
      if (!record) continue;
      const envelope = readImportDraftEnvelope(record);
      if (!envelope || envelope.draft.id !== draft.id) continue;

      const fingerprint = actionFingerprint(action, draft.id);
      if (
        envelope.reviewState.actionHistory.some(
          (entry) => entry.fingerprint === fingerprint,
        )
      ) {
        affectedDraftIds.push(draft.id);
        continue;
      }

      const now = new Date().toISOString();
      const editedDraft = applyDraftEdits(envelope.draft, action.edits);
      const decision = reviewDecision(action.type);
      const nextEnvelope = {
        ...envelope,
        draft: editedDraft,
        reviewState: {
          ...envelope.reviewState,
          decision,
          resolution:
            action.type === 'merge_into_existing'
              ? ('merge_into_existing' as const)
              : action.type === 'create_new'
                ? ('create_new' as const)
                : envelope.reviewState.resolution,
          selectedDuplicateEventId:
            action.type === 'select_duplicate' ||
            action.type === 'merge_into_existing'
              ? action.targetEventId
              : envelope.reviewState.selectedDuplicateEventId,
          reviewedBy: action.actorId ?? envelope.reviewState.reviewedBy,
          reviewedAt: now,
          actionHistory: [
            ...envelope.reviewState.actionHistory,
            {
              fingerprint,
              type: action.type,
              actorId: action.actorId,
              at: now,
              targetEventId: action.targetEventId,
            },
          ],
        },
      };

      const status =
        decision === 'approved'
          ? 'approved'
          : decision === 'rejected'
            ? 'rejected'
            : action.type === 'select_duplicate'
              ? 'duplicate'
              : 'needs_review';
      const nextRecord = replaceImportDraftEnvelope(record, nextEnvelope);
      await this.admin.updateIfUnchanged(
        {
          ...nextRecord,
          status,
          reviewedBy: action.actorId ?? record.reviewedBy,
          reviewedAt: now,
          rejectReason: action.type === 'reject' ? 'other' : record.rejectReason,
          rejectNote: action.type === 'reject' ? action.note : record.rejectNote,
          duplicateEventId:
            action.type === 'select_duplicate' ||
            action.type === 'merge_into_existing'
              ? action.targetEventId
              : record.duplicateEventId,
          reviewerEdits: {
            ...(record.reviewerEdits ?? {}),
            ...(typeof action.edits?.title === 'string'
              ? { title: action.edits.title }
              : {}),
            ...(Array.isArray(action.edits?.genres)
              ? { genreNames: nextEnvelope.draft.genres.normalizedLabels }
              : {}),
          },
        },
        record.updatedAt,
      );
      databaseWriteOperations += 1;
      affectedDraftIds.push(draft.id);
    }

    return {
      accepted: affectedDraftIds.length > 0,
      action,
      affectedDraftIds,
      databaseWriteOperations,
      productionMutations: 0,
      message: `import_records_only:${action.type}`,
    };
  }
}

export function groupDraftsByReviewTrack(
  drafts: ImportDraft[],
): Record<ReviewTrack, ImportDraft[]> {
  return {
    auto_ready: drafts.filter((draft) => draft.reviewTrack === 'auto_ready'),
    quick_review: drafts.filter((draft) => draft.reviewTrack === 'quick_review'),
    conflict_review: drafts.filter((draft) => draft.reviewTrack === 'conflict_review'),
  };
}

export function selectAllSafeDraftIds(drafts: ImportDraft[]): string[] {
  return drafts
    .filter((draft) => draft.reviewTrack === 'auto_ready')
    .map((draft) => draft.id);
}
