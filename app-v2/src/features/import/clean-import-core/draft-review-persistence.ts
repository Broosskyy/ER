import type { ImportDraft, ReviewTrack } from './import-draft';

export type DraftReviewActionType =
  | 'approve'
  | 'batch_approve'
  | 'reject'
  | 'edit'
  | 'merge_into_existing'
  | 'create_new';

export interface DraftReviewAction {
  type: DraftReviewActionType;
  draftIds: string[];
  edits?: Record<string, string | string[] | number | undefined>;
  targetEventId?: string;
  note?: string;
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
  return drafts.filter((draft) => draft.reviewTrack === 'auto_ready').map((draft) => draft.id);
}
