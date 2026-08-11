import type { CanonicalEvent } from './event-evidence';
import { hasStablePublicIdentity } from './identity-resolver';
import { ImportRunner } from './import-runner';
import {
  buildImportDraft,
  type DraftDuplicateCandidate,
  type DraftFieldChange,
  type ImportDraft,
} from './import-draft';
import { resolveGenreContract } from './genre-contract';
import {
  isWiredImportSubmissionKind,
  submissionToConnectorOutputs,
  type ImportSubmission,
} from './import-submission';
import {
  NoopDraftReviewPersistence,
  type DraftReviewPersistence,
} from './draft-review-persistence';
import {
  NoopImportDraftRecordPersistence,
  type ImportDraftRecordPersistence,
} from './import-draft-record-persistence';
import type { ImportDraftRecordContext } from './import-draft-record-mapper';

export interface UnifiedImportDraftResult {
  draft: ImportDraft;
  /** Always zero — no events table writes from this path. */
  databaseWriteOperations: number;
  productionMutations: 0;
  rolloutActivated: false;
  wroteEventsTable: false;
}

/**
 * Single ingress path for automatic sources, community, organizer, and admin URL submissions.
 * Never writes events directly; review actions use dry-run/noop persistence.
 */
export class UnifiedImportDraftService {
  constructor(
    private readonly runner = new ImportRunner(),
    private readonly reviewPersistence: DraftReviewPersistence = new NoopDraftReviewPersistence(),
    private readonly draftPersistence: ImportDraftRecordPersistence =
      new NoopImportDraftRecordPersistence(),
  ) {}

  getReviewPersistence(): DraftReviewPersistence {
    return this.reviewPersistence;
  }

  process(submission: ImportSubmission): UnifiedImportDraftResult {
    if (!isWiredImportSubmissionKind(submission.kind)) {
      throw new Error(`import_submission_kind_not_wired:${submission.kind}`);
    }

    const outputs = submissionToConnectorOutputs(submission);
    const core = this.runner.run(outputs);
    const payload = submission.payload ?? {};

    const primary = core.evidence[0];
    const evidenceGenres = core.evidence
      .flatMap((entry) => entry.content.genres?.value ?? [])
      .filter((value, index, all) => all.indexOf(value) === index);
    const rawGenres =
      (evidenceGenres.length ? evidenceGenres : undefined) ??
      payload.genres ??
      core.canonicalEvent?.genres;
    const genres = resolveGenreContract({
      rawGenres,
      sourceId: primary?.sourceId ?? submission.sourceId ?? submission.kind,
      sourceUrl: primary?.sourceUrl,
      sourceFamily: primary?.sourceFamily,
      submissionKind: submission.kind,
      existingConfirmedGenres: submission.existingConfirmedGenres,
    });

    const duplicates = resolveDuplicates(submission);
    const hasCriticalConflict =
      core.decision === 'review' ||
      core.reviewReasons.some((reason) =>
        /mismatch|collision|critical|ticket_relationship/i.test(reason),
      );
    const hasVerifiedEvidence = core.evidence.some((entry) => Boolean(entry.verifiedAt?.trim()));
    const hasStableIdentity = core.evidence.some((entry) => hasStablePublicIdentity(entry));

    const missingOptionalFields = [...core.missingOptionalFields];
    if (submission.kind !== 'automatic_source' && !payload.imageUrl?.trim()) {
      missingOptionalFields.push('image');
    }

    // Official sources win critical identity conflicts over community submissions.
    const reviewReasons = [...core.reviewReasons];
    if (
      submission.kind === 'community_manual' &&
      hasCriticalConflict &&
      core.evidence.some((entry) => entry.sourceFamily === 'official_website')
    ) {
      reviewReasons.push('official_source_precedence');
    }
    if (submission.kind === 'community_manual' && !hasStableIdentity) {
      reviewReasons.push('community_requires_review');
    }

    const proposedFieldChanges = buildProposedFieldChanges(submission, core.canonicalEvent, genres.normalizedLabels);

    const draft = buildImportDraft({
      submission,
      canonicalEvent: core.canonicalEvent,
      evidence: core.evidence,
      coreDecision: core.decision,
      missingRequiredFields: core.missingRequiredFields,
      missingOptionalFields,
      reviewReasons,
      genres,
      duplicates,
      proposedFieldChanges,
      hasStableIdentity,
      hasCriticalConflict,
      hasVerifiedEvidence,
    });

    return {
      draft,
      databaseWriteOperations: 0,
      productionMutations: 0,
      rolloutActivated: false,
      wroteEventsTable: false,
    };
  }

  async processAndPersist(
    submission: ImportSubmission,
    context: ImportDraftRecordContext,
  ): Promise<UnifiedImportDraftResult> {
    const result = this.process(submission);
    const persisted = await this.draftPersistence.persist(result.draft, context);
    return {
      draft: persisted.draft,
      databaseWriteOperations: persisted.databaseWriteOperations,
      productionMutations: 0,
      rolloutActivated: false,
      wroteEventsTable: false,
    };
  }
}

function resolveDuplicates(submission: ImportSubmission): DraftDuplicateCandidate[] {
  const duplicates: DraftDuplicateCandidate[] = [];
  const payload = submission.payload ?? {};

  if (payload.correctionTargetEventId) {
    duplicates.push({
      eventId: payload.correctionTargetEventId,
      reason: 'community_correction_target',
      recommendedAction: 'merge_into_existing',
    });
  }

  for (const eventId of submission.knownDuplicateEventIds ?? []) {
    if (duplicates.some((entry) => entry.eventId === eventId)) continue;
    duplicates.push({
      eventId,
      reason: 'known_duplicate_hint',
      recommendedAction: 'manual_compare',
    });
  }

  return duplicates;
}

function buildProposedFieldChanges(
  submission: ImportSubmission,
  canonical: CanonicalEvent | undefined,
  genres: string[],
): DraftFieldChange[] {
  const payload = submission.payload ?? {};
  const changes: DraftFieldChange[] = [];
  if (payload.title && canonical?.title) {
    changes.push({
      field: 'title',
      proposedValue: canonical.title,
      highlight: submission.kind !== 'automatic_source',
    });
  }
  if (genres.length) {
    changes.push({
      field: 'genres',
      previousValue: submission.existingConfirmedGenres?.join(', '),
      proposedValue: genres.join(', '),
      highlight: !submission.existingConfirmedGenres?.length,
    });
  }
  if (payload.correctionTargetEventId) {
    changes.push({
      field: 'identity',
      proposedValue: 'supplement_existing',
      highlight: true,
    });
  }
  if (payload.description && !canonical?.description) {
    changes.push({
      field: 'description',
      proposedValue: payload.description,
      highlight: true,
    });
  }
  return changes;
}
