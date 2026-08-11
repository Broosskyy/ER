import type { ImportDraft, ReviewTrack } from './import-draft';
import {
  NoopDraftReviewPersistence,
  groupDraftsByReviewTrack,
  selectAllSafeDraftIds,
  type DraftReviewAction,
  type DraftReviewActionResult,
  type DraftReviewPersistence,
} from './draft-review-persistence';

/** Compact admin review card — technical evidence stays under Diagnose. */
export interface CompactDraftReviewCard {
  draftId: string;
  reviewTrack: ReviewTrack;
  title: string;
  dateTime: string;
  venue: string;
  genres: string[];
  genreChips: string[];
  uncertainGenres: string[];
  lineup: string[];
  ticketStatus: string;
  ticketPrice?: string;
  imageUrl?: string;
  sourceLabel: string;
  highlightedChanges: string[];
  missingFields: string[];
  recommendedDuplicateAction?: ImportDraft['recommendedDuplicateAction'];
  selected: boolean;
  diagnose: {
    reviewReasons: string[];
    evidenceSourceIds: string[];
    provenanceSourceIds: string[];
    coreDecision: string;
    diagnostics: string[];
  };
}

export interface AdminDraftReviewQueueViewModel {
  groups: Record<ReviewTrack, CompactDraftReviewCard[]>;
  selectedDraftIds: string[];
  autoReadyCount: number;
  quickReviewCount: number;
  conflictReviewCount: number;
}

export function buildCompactDraftReviewCard(
  draft: ImportDraft,
  selected = false,
): CompactDraftReviewCard {
  const event = draft.proposedCanonicalEvent;
  const lineup =
    event?.lineup?.map((entry) => entry.displayName).filter(Boolean) ??
    (event?.lineupState === 'tba' ? ['TBA'] : []);
  const price = event?.admissionPrice;
  const ticketPrice = price
    ? `${price.amount} ${price.currency}${price.text ? ` (${price.text})` : ''}`
    : undefined;
  const highlightedChanges = draft.proposedFieldChanges
    .filter((change) => change.highlight)
    .map((change) =>
      change.previousValue
        ? `${change.field}: ${change.previousValue} → ${change.proposedValue ?? '—'}`
        : `${change.field}: ${change.proposedValue ?? 'neu'}`,
    );

  return {
    draftId: draft.id,
    reviewTrack: draft.reviewTrack,
    title: event?.title?.trim() || 'Ohne Titel',
    dateTime: event?.startDate?.trim() || 'Datum offen',
    venue: event?.venueName?.trim() || event?.locationText?.trim() || 'Venue offen',
    genres: draft.genres.normalizedLabels,
    genreChips: draft.genres.chipSuggestions,
    uncertainGenres: draft.genres.uncertainLabels,
    lineup,
    ticketStatus: event?.ticketStatus ?? (event?.ticketUrl ? 'available' : 'unknown'),
    ticketPrice,
    imageUrl: draft.imageUrl,
    sourceLabel:
      draft.sources[0]?.sourceFamily ??
      draft.submissionKind,
    highlightedChanges,
    missingFields: draft.missingFields,
    recommendedDuplicateAction: draft.recommendedDuplicateAction,
    selected,
    diagnose: {
      reviewReasons: draft.reviewReasons,
      evidenceSourceIds: draft.evidence.map((entry) => entry.sourceId),
      provenanceSourceIds: draft.audit.provenanceSourceIds,
      coreDecision: draft.audit.coreDecision,
      diagnostics: draft.evidence.flatMap((entry) => entry.diagnostics),
    },
  };
}

export function buildAdminDraftReviewQueueViewModel(
  drafts: ImportDraft[],
  selectedDraftIds: string[] = [],
): AdminDraftReviewQueueViewModel {
  const selected = new Set(selectedDraftIds);
  const grouped = groupDraftsByReviewTrack(drafts);
  const toCards = (entries: ImportDraft[]) =>
    entries.map((draft) => buildCompactDraftReviewCard(draft, selected.has(draft.id)));

  return {
    groups: {
      auto_ready: toCards(grouped.auto_ready),
      quick_review: toCards(grouped.quick_review),
      conflict_review: toCards(grouped.conflict_review),
    },
    selectedDraftIds,
    autoReadyCount: grouped.auto_ready.length,
    quickReviewCount: grouped.quick_review.length,
    conflictReviewCount: grouped.conflict_review.length,
  };
}

export class AdminDraftReviewController {
  constructor(
    private readonly persistence: DraftReviewPersistence = new NoopDraftReviewPersistence(),
  ) {}

  selectAllSafe(drafts: ImportDraft[]): string[] {
    return selectAllSafeDraftIds(drafts);
  }

  async approveOne(draft: ImportDraft): Promise<DraftReviewActionResult> {
    return this.persistence.apply({ type: 'approve', draftIds: [draft.id] }, [draft]);
  }

  async batchApprove(drafts: ImportDraft[], draftIds: string[]): Promise<DraftReviewActionResult> {
    return this.persistence.apply({ type: 'batch_approve', draftIds }, drafts);
  }

  async reject(draft: ImportDraft, note?: string): Promise<DraftReviewActionResult> {
    return this.persistence.apply({ type: 'reject', draftIds: [draft.id], note }, [draft]);
  }

  async edit(
    draft: ImportDraft,
    edits: DraftReviewAction['edits'],
  ): Promise<DraftReviewActionResult> {
    return this.persistence.apply({ type: 'edit', draftIds: [draft.id], edits }, [draft]);
  }

  async mergeIntoExisting(
    draft: ImportDraft,
    targetEventId: string,
  ): Promise<DraftReviewActionResult> {
    return this.persistence.apply(
      { type: 'merge_into_existing', draftIds: [draft.id], targetEventId },
      [draft],
    );
  }

  async createNew(draft: ImportDraft): Promise<DraftReviewActionResult> {
    return this.persistence.apply({ type: 'create_new', draftIds: [draft.id] }, [draft]);
  }
}
