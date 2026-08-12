import { createHash } from 'node:crypto';

import type { ImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';
import { formatMinimumAgeLabel } from '@/features/import/domain/canonical-ticket-phase';

import type {
  DraftEligibilityAssessment,
  DraftFieldPreviewEntry,
} from './draft-publish-eligibility';
import { IdentityResolver } from './identity-resolver';
import type { ImportDraft } from './import-draft';

const IDENTITY_VERDICT_SCORE: Record<string, number> = {
  exact: 100,
  corroborated: 80,
  mismatch: 0,
  unverifiable: 10,
  duplicate_candidate: 5,
  identity_conflict: 0,
  missing_core: 0,
};

export interface ApprovedPublishCandidateSelection {
  assessment: DraftEligibilityAssessment;
  draft: ImportDraft;
  targetEventId: string;
  patch: ImportPublishFieldPatch;
  protectedFields: string[];
  mutationCount: number;
  identityScore: number;
  identityReasons: string[];
}

export interface ControlledPublishManifestInput {
  draftId: string;
  targetEventId: string;
  eventBefore: Record<string, unknown>;
  eventRowFingerprint: string;
  draftBefore: Record<string, unknown>;
  provenanceBefore: Record<string, unknown>[];
  sourceReferenceBefore: Record<string, unknown> | null;
  lineupBefore?: Record<string, unknown>[];
  patch: ImportPublishFieldPatch;
  protectedFields: string[];
  rollback: {
    event: Record<string, unknown>;
    provenance: Record<string, unknown>[];
    sourceReference: Record<string, unknown> | null;
    importRecord: Record<string, unknown>;
    lineup?: Record<string, unknown>[];
  };
}

export function stableJson(value: unknown): string {
  const stableValue = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(stableValue);
    if (!entry || typeof entry !== 'object') return entry;
    return Object.fromEntries(
      Object.entries(entry as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  };
  return JSON.stringify(stableValue(value));
}

export function fingerprint(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

export function countPlannedFieldMutations(fieldPreview: DraftFieldPreviewEntry[]): number {
  return fieldPreview.filter((entry) => entry.action === 'update' || entry.action === 'insert').length;
}

export function identityEvidenceScore(draft: ImportDraft): number {
  const resolution = new IdentityResolver().resolve(draft.evidence);
  const verdictScore = IDENTITY_VERDICT_SCORE[resolution.verdict] ?? 0;
  return verdictScore + resolution.acceptedEvidence.length * 10 + (draft.verifiedAt?.trim() ? 5 : 0);
}

export function identityResolutionReasons(draft: ImportDraft): string[] {
  return new IdentityResolver().resolve(draft.evidence).reasons;
}

function hasContradictoryEvidence(
  assessment: DraftEligibilityAssessment,
  draft: ImportDraft,
): boolean {
  const reasons = identityResolutionReasons(draft);
  if (
    reasons.some((reason) =>
      /title_mismatch|date_mismatch|venue_mismatch|contradict/i.test(reason),
    )
  ) {
    return true;
  }
  return assessment.blockingReasons.some(
    (reason) =>
      /title|date|venue/i.test(reason) && /mismatch|conflict|contradict/i.test(reason),
  );
}

export function isStrictApprovedPublishCandidate(
  assessment: DraftEligibilityAssessment,
  draft: ImportDraft,
): boolean {
  if (assessment.storedReviewDecision !== 'approved') return false;
  if (!assessment.automaticPublishEligible) return false;
  if (assessment.identityVerdict !== 'exact') return false;
  if (assessment.publishOutcome !== 'safe_existing_update') return false;
  if (assessment.matchedEventIds.length !== 1) return false;
  if (assessment.blockingReasons.length > 0) return false;
  if (assessment.consumerPreview.issues.length > 0) return false;
  if (!draft.verifiedAt?.trim()) return false;
  if (assessment.fieldPreview.some((entry) => entry.action === 'blocked_manual_lock')) {
    return false;
  }
  if (draft.duplicates.some((duplicate) => duplicate.reason !== 'community_correction_target')) {
    return false;
  }
  if (hasContradictoryEvidence(assessment, draft)) return false;
  return countPlannedFieldMutations(assessment.fieldPreview) > 0;
}

export function mapFieldPreviewToImportPatch(
  fieldPreview: DraftFieldPreviewEntry[],
): ImportPublishFieldPatch {
  const patch: ImportPublishFieldPatch = {};
  for (const entry of fieldPreview) {
    if (entry.action !== 'update' && entry.action !== 'insert') continue;
    switch (entry.field) {
      case 'genres':
        patch.genreLabels = Array.isArray(entry.proposedValue)
          ? entry.proposedValue.map(String)
          : undefined;
        break;
      case 'minimumAge': {
        const raw = entry.proposedValue;
        const numeric =
          typeof raw === 'number'
            ? raw
            : typeof raw === 'string'
              ? Number.parseInt(raw.replace(/\D/g, ''), 10)
              : Number.NaN;
        patch.ageRestriction = formatMinimumAgeLabel(
          Number.isFinite(numeric) ? numeric : undefined,
        );
        break;
      }
      case 'lineup':
        break;
      case 'ticketStatus':
        patch.ticketStatus = entry.proposedValue as ImportPublishFieldPatch['ticketStatus'];
        break;
      case 'ticketPhases':
        patch.ticketPhases = entry.proposedValue as ImportPublishFieldPatch['ticketPhases'];
        break;
      case 'venueEnvironment':
        patch.venueEnvironment = entry.proposedValue as ImportPublishFieldPatch['venueEnvironment'];
        break;
      default:
        (patch as Record<string, unknown>)[entry.field] = entry.proposedValue;
    }
  }
  return patch;
}

export function listProtectedFields(fieldPreview: DraftFieldPreviewEntry[]): string[] {
  return fieldPreview.filter((entry) => entry.action === 'preserve').map((entry) => entry.field);
}

export function lineupWouldChange(fieldPreview: DraftFieldPreviewEntry[]): boolean {
  return fieldPreview.some(
    (entry) =>
      entry.field === 'lineup' &&
      (entry.action === 'update' || entry.action === 'insert'),
  );
}

export function selectDeterministicApprovedPublishCandidate(input: {
  assessments: DraftEligibilityAssessment[];
  draftsById: Map<string, ImportDraft>;
}): ApprovedPublishCandidateSelection | null {
  const eligible = input.assessments
    .map((assessment) => {
      const draft = input.draftsById.get(assessment.draftId);
      if (!draft || !isStrictApprovedPublishCandidate(assessment, draft)) return null;
      const targetEventId = assessment.matchedEventIds[0]!;
      const patch = mapFieldPreviewToImportPatch(assessment.fieldPreview);
      return {
        assessment,
        draft,
        targetEventId,
        patch,
        protectedFields: listProtectedFields(assessment.fieldPreview),
        mutationCount: countPlannedFieldMutations(assessment.fieldPreview),
        identityScore: identityEvidenceScore(draft),
        identityReasons: identityResolutionReasons(draft),
      } satisfies ApprovedPublishCandidateSelection;
    })
    .filter((entry): entry is ApprovedPublishCandidateSelection => Boolean(entry));

  if (!eligible.length) return null;

  eligible.sort((left, right) => {
    if (left.mutationCount !== right.mutationCount) {
      return left.mutationCount - right.mutationCount;
    }
    if (left.identityScore !== right.identityScore) {
      return right.identityScore - left.identityScore;
    }
    return left.assessment.draftId.localeCompare(right.assessment.draftId);
  });

  return eligible[0] ?? null;
}

export function buildStableManifestHash(
  manifest: Omit<ControlledPublishManifestInput, 'rollback'> & {
    rollback: Omit<ControlledPublishManifestInput['rollback'], never>;
  },
): string {
  const volatileKeys = new Set([
    'updated_at',
    'created_at',
    'reviewed_at',
    'retrieved_at',
    'published_at',
    'last_seen_at',
    'first_seen_at',
    'processing_lease_expires_at',
    'lastSeenAt',
    'firstSeenAt',
    'reviewedAt',
    'retrievedAt',
    'publishedAt',
  ]);
  const stripVolatile = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(stripVolatile);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !volatileKeys.has(key))
        .map(([key, nested]) => [key, stripVolatile(nested)]),
    );
  };
  const hashInput = {
    draftId: manifest.draftId,
    targetEventId: manifest.targetEventId,
    eventRowFingerprint: manifest.eventRowFingerprint,
    patch: manifest.patch,
    protectedFields: manifest.protectedFields,
    eventBefore: stripVolatile(manifest.eventBefore),
    draftBefore: stripVolatile(manifest.draftBefore),
    provenanceBefore: stripVolatile(manifest.provenanceBefore),
    sourceReferenceBefore: stripVolatile(manifest.sourceReferenceBefore),
    lineupBefore: stripVolatile(manifest.lineupBefore ?? null),
    rollback: {
      event: stripVolatile(manifest.rollback.event),
      provenance: stripVolatile(manifest.rollback.provenance),
      sourceReference: stripVolatile(manifest.rollback.sourceReference),
      importRecord: stripVolatile(manifest.rollback.importRecord),
      lineup: stripVolatile(manifest.rollback.lineup ?? null),
    },
  };
  return fingerprint(hashInput);
}
