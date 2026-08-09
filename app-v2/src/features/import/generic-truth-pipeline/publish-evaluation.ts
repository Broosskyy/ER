import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { resolveDescriptionGenrePublish } from '@/features/import/domain/description-genre-publish-resolver';
import {
  evaluateEventEvidenceIdentityGate,
  type IdentityPublishVerdict,
} from '@/features/import/domain/event-evidence-identity-gate';
import { evaluateLineupPublishGate } from '@/features/import/domain/lineup-publish-gate';
import { evaluateTicketEvidenceFreshness } from '@/features/import/domain/ticket-evidence-freshness-merge';
import {
  applyImportPublishFieldPatch,
  buildImportPublishFieldPatch,
  type ImportPublishFieldPatch,
} from '@/features/import/services/import-event-field-mapper';
import { assertEnrichmentNotBlockedByCollision } from '@/features/import/ticket-platform-identity/collision-guards';
import type { EventIdentitySnapshot } from '@/features/import/ticket-platform-identity/types';

import { evaluateCanonicalIdentityCollision } from './canonical-identity-collision';
import { canonicalImportEventToEvidenceBundle, adminEventToIdentitySnapshot } from './evidence-from-canonical';
import {
  buildFieldGroupDeltas,
  filterBlockedPatch,
  patchHasApplicableChanges,
  snapshotFromEvent,
  type FieldGroupDeltaReport,
} from './field-delta';
import {
  classifyFieldGroupEligibility,
  type FieldGroupEligibilityReport,
} from './field-group-eligibility';
import {
  isEventInCanary,
  isRolloutModeAllowsActivation,
  isSourceInRolloutScope,
  resolveGenericTruthRollout,
  type GenericTruthRolloutConfig,
} from './rollout';
import type {
  GenericTruthFieldGroup,
  SourceEvidenceBundle,
} from './source-evidence-contract';
import { ALL_GENERIC_TRUTH_FIELD_GROUPS } from './source-evidence-contract';

export interface FieldGroupEvaluation {
  group: GenericTruthFieldGroup;
  proposed: boolean;
  blocked: boolean;
  blockReasons: string[];
  allowed: boolean;
}

export interface GenericTruthPublishEvaluation {
  eventId: string;
  sourceId: string;
  adapterId?: string;
  evidenceCoverage: Record<string, boolean>;
  evidenceOrigin: string;
  identityEvidenceOrigin: string;
  sourceNativeEvidence: boolean;
  legacyFallbackUsed: boolean;
  criticalIdentitySelfDerived: boolean;
  identityVerdict: IdentityPublishVerdict;
  identityReason: string;
  freshnessApply: boolean;
  freshnessReason: string;
  collision: boolean;
  collisionReasons: string[];
  collisionEventIds?: string[];
  fieldGroups: FieldGroupEvaluation[];
  fieldGroupDeltas: FieldGroupDeltaReport[];
  dryRunBefore: Record<string, unknown>;
  dryRunAfter: Record<string, unknown>;
  noChange: boolean;
  wouldChange: boolean;
  proposedChange: boolean;
  policyEligible: boolean;
  activationEligible: boolean;
  wouldApplyIfEnabled: boolean;
  reviewRequired: boolean;
  reviewReasons: string[];
  autoEligible: boolean;
  consumerImpact: string[];
  blockReasons: string[];
  diagnostics: string[];
  rolloutMode: GenericTruthRolloutConfig['mode'];
  writesSuppressed: boolean;
  fieldGroupEligibility: FieldGroupEligibilityReport;
  canonicalCollisionVerdict: 'none' | 'collision_review_required';
}

export interface EvaluateGenericTruthPublishInput {
  existing: AdminEventRecord;
  candidate: CanonicalImportEvent;
  bundle?: SourceEvidenceBundle;
  adapterId?: string;
  rollout?: GenericTruthRolloutConfig;
  manualLocks?: Set<string>;
  fillOnly?: boolean;
  collisionCatalog?: EventIdentitySnapshot[];
  allowedFieldGroups?: readonly GenericTruthFieldGroup[];
}

const IDENTITY_OK: IdentityPublishVerdict[] = ['exact', 'corroborated'];

function buildFieldGroupEvaluations(
  deltas: FieldGroupDeltaReport[],
  blockedGroups: Partial<Record<GenericTruthFieldGroup, string>>,
): FieldGroupEvaluation[] {
  return deltas.map((delta) => {
    const blocked = Boolean(blockedGroups[delta.group]);
    const proposed = Object.keys(delta.proposed as object).length > 0;
    return {
      group: delta.group,
      proposed,
      blocked,
      blockReasons: blocked ? [blockedGroups[delta.group]!] : [],
      allowed: proposed && !blocked && delta.wouldChange,
    };
  });
}

function resolveIdentityEvidence(bundle: SourceEvidenceBundle) {
  if (!bundle.sourceNativeEvidence || bundle.criticalIdentitySelfDerived) {
    return {
      pageTitle: undefined,
      listRowTitle: undefined,
      eventDate: undefined,
      venueName: undefined,
    };
  }
  return {
    pageTitle: bundle.identity.pageTitle,
    listRowTitle: bundle.identity.listRowTitle,
    eventDate: bundle.identity.eventDate,
    venueName: bundle.identity.venueName,
  };
}

export function evaluateGenericTruthPublish(
  input: EvaluateGenericTruthPublishInput,
): GenericTruthPublishEvaluation {
  const rollout = input.rollout ?? resolveGenericTruthRollout();
  const bundle = input.bundle ?? canonicalImportEventToEvidenceBundle(input.candidate);
  const metadata = (input.candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};
  const verifiedAtMissing = !bundle.verifiedAt?.trim();
  const identityEvidence = resolveIdentityEvidence(bundle);

  const contaminationFlag = bundle.contamination?.detected === true;
  const targetSnapshot: EventIdentitySnapshot = {
    ...adminEventToIdentitySnapshot(input.existing),
    ticketUrl: input.existing.ticketUrl ?? bundle.tickets?.publicCtaCandidateUrl,
  };
  const collisionGuard = assertEnrichmentNotBlockedByCollision({
    targetEvent: targetSnapshot,
    catalog: input.collisionCatalog ?? [targetSnapshot],
    publicEvidence: bundle.sourceNativeEvidence ? identityEvidence : undefined,
  });
  const compositeCollision =
    collisionGuard.blocked && collisionGuard.reason === 'composite_identity_collision';
  const canonicalCollision = evaluateCanonicalIdentityCollision(
    {
      ...adminEventToIdentitySnapshot(input.existing),
      ticketUrl: input.existing.ticketUrl ?? bundle.tickets?.publicCtaCandidateUrl,
      websiteUrl: input.existing.websiteUrl ?? readString(metadata, 'officialEventUrl'),
      sourceId: bundle.sourceId,
    },
    (input.collisionCatalog ?? []).map((entry) => ({
      ...entry,
      websiteUrl: entry.websiteUrl,
      sourceId: entry.sourceId ?? bundle.sourceId,
    })),
  );
  const canonicalCollisionDetected = canonicalCollision.verdict === 'collision_review_required';
  const collisionReasons = compositeCollision
    ? ['composite_identity_collision']
    : canonicalCollisionDetected
      ? canonicalCollision.reasons
      : contaminationFlag
        ? bundle.contamination?.reasons ?? ['contamination']
        : [];

  let identityGate = evaluateEventEvidenceIdentityGate({
    event: adminEventToIdentitySnapshot(input.existing),
    evidence: identityEvidence,
    officialEventUrl: input.existing.websiteUrl ?? readString(metadata, 'officialEventUrl'),
    evidenceUrl: bundle.sourceUrl,
    verifiedAt: bundle.verifiedAt,
  });

  if (bundle.criticalIdentitySelfDerived || !bundle.sourceNativeEvidence) {
    identityGate = {
      ...identityGate,
      verdict: 'unverifiable',
      criticalFieldsPublishAllowed: false,
      ticketEvidenceBlocked: true,
      reason: bundle.legacyFallbackUsed
        ? 'no_source_native_identity_evidence'
        : identityGate.reason,
      diagnostics: [
        ...identityGate.diagnostics,
        bundle.legacyFallbackUsed ? 'legacy_canonical_fallback' : 'missing_native_evidence',
      ],
    };
  }

  const freshness = evaluateTicketEvidenceFreshness({
    existingVerifiedAt: undefined,
    incomingVerifiedAt: bundle.verifiedAt,
    identityVerdict: identityGate.verdict,
    manualLocked: (input.manualLocks?.size ?? 0) > 0,
    hasIncomingSnapshot: Boolean(bundle.verifiedAt),
  });

  const detailBlocked =
    metadata.detailEnrichment === 'blocked' || metadata.lineupBlockerClass != null;

  const ticketWrite = writeCanonicalTicketFields({
    existing: input.existing,
    candidate: input.candidate,
    fillOnly: input.fillOnly,
    detailBlocked,
    manualLocks: input.manualLocks,
  });

  const descriptionGenre = resolveDescriptionGenrePublish({
    existingDescription: input.existing.description,
    existingGenres: input.existing.genreLabels,
    officialDescription: bundle.content?.description,
    officialHtml: readString(metadata, 'officialHtml'),
    ticketPlatformDescription: readString(metadata, 'ticketPlatformDescription'),
    ticketPlatformGenres: bundle.content?.genreLabels,
    event: adminEventToIdentitySnapshot(input.existing),
    ticketEvidence: identityEvidence,
    sourceId: bundle.sourceId,
    observedAt: bundle.observedAt,
  });

  const lineupGate = evaluateLineupPublishGate({
    event: adminEventToIdentitySnapshot(input.existing),
    contentBlocks: bundle.content?.description ? [bundle.content.description] : [],
    identityEvidence: {
      evidence: identityEvidence,
      verifiedAt: bundle.verifiedAt,
      evidenceUrl: bundle.sourceUrl,
    },
    contaminationDetected: compositeCollision || canonicalCollisionDetected || contaminationFlag,
  });

  const patch = buildImportPublishFieldPatch(input.candidate, {
    existing: input.existing,
    fillOnly: input.fillOnly,
  });

  const identityBlocked = !IDENTITY_OK.includes(identityGate.verdict);
  const ticketBlocked =
    ticketWrite.audit.blockedCriticalFields.length > 0 || identityGate.ticketEvidenceBlocked;
  const descriptionBlocked = Boolean(descriptionGenre.blockedReason);
  const genreBlocked = Boolean(descriptionGenre.blockedReason) && !descriptionGenre.genreLabels?.length;
  const lineupBlocked = !lineupGate.allowed;

  const blockedGroups: Partial<Record<GenericTruthFieldGroup, string>> = {};
  if (compositeCollision || contaminationFlag || canonicalCollisionDetected) {
    blockedGroups.identity_schedule_venue = 'collision_or_contamination';
    blockedGroups.tickets = 'collision_or_contamination';
    blockedGroups.cta_checkout = 'collision_or_contamination';
  }
  if (identityBlocked) blockedGroups.identity_schedule_venue = 'identity_gate';
  if (verifiedAtMissing) blockedGroups.tickets = 'verified_at_required';
  if (ticketBlocked) blockedGroups.tickets = 'ticket_gate';
  if (descriptionBlocked) blockedGroups.description = descriptionGenre.blockedReason ?? 'description_blocked';
  if (genreBlocked) blockedGroups.genres = descriptionGenre.blockedReason ?? 'genre_blocked';
  if (lineupBlocked) blockedGroups.lineup = lineupGate.reason;

  if (input.allowedFieldGroups) {
    for (const group of ALL_GENERIC_TRUTH_FIELD_GROUPS) {
      if (!input.allowedFieldGroups.includes(group)) {
        blockedGroups[group] = blockedGroups[group] ?? 'restricted_canary_scope';
      }
    }
  }

  const applicablePatch = filterBlockedPatch(patch, blockedGroups);
  const fieldGroupDeltas = buildFieldGroupDeltas({
    before: input.existing,
    patch: applicablePatch,
    blockedGroups,
  });
  const fieldGroups = buildFieldGroupEvaluations(fieldGroupDeltas, blockedGroups);

  const wouldChange = patchHasApplicableChanges(input.existing, applicablePatch, blockedGroups);
  const noChange = !wouldChange;
  const proposedChange = wouldChange;

  const dryRunAfterEvent = applyImportPublishFieldPatch(
    { ...input.existing, updatedAt: input.existing.updatedAt },
    applicablePatch,
  );
  const dryRunBefore = snapshotFromEvent(input.existing);
  const dryRunAfter = snapshotFromEvent(dryRunAfterEvent);

  const reviewReasons: string[] = [];
  if (identityGate.verdict === 'partial_review_only') reviewReasons.push('identity_partial_review');
  if (identityGate.verdict === 'mismatch') reviewReasons.push('identity_mismatch');
  if (identityGate.verdict === 'unverifiable' && bundle.sourceNativeEvidence) {
    reviewReasons.push('identity_unverifiable');
  }
  if (compositeCollision) reviewReasons.push('composite_identity_collision');
  if (canonicalCollisionDetected) reviewReasons.push('collision_review_required');
  if (contaminationFlag) reviewReasons.push('contamination');
  if (identityGate.canonicalIdentityReviewRequired) reviewReasons.push('canonical_identity_review');

  const policyEligible =
    IDENTITY_OK.includes(identityGate.verdict) &&
    !compositeCollision &&
    !canonicalCollisionDetected &&
    !contaminationFlag &&
    !verifiedAtMissing &&
    bundle.sourceNativeEvidence &&
    !bundle.criticalIdentitySelfDerived &&
    !ticketBlocked &&
    wouldChange;

  const fieldGroupEligibility = classifyFieldGroupEligibility({
    fieldGroups,
    fieldGroupDeltas,
    identityVerdict: identityGate.verdict,
    verifiedAtPresent: !verifiedAtMissing,
    sourceNativeEvidence: bundle.sourceNativeEvidence,
    collision: compositeCollision || canonicalCollisionDetected,
    contamination: contaminationFlag,
  });

  const wouldApplyIfEnabled = policyEligible && Object.keys(applicablePatch).length > 0;

  const activationEligible =
    policyEligible &&
    rollout.enabled &&
    isRolloutModeAllowsActivation(rollout) &&
    isSourceInRolloutScope(bundle.sourceId, rollout) &&
    isEventInCanary(bundle.sourceId, input.existing.id, rollout);

  const reviewRequired = reviewReasons.length > 0;
  const autoEligible = activationEligible && rollout.mode === 'automatic' && rollout.autoPublishEnabled;

  const canonicalTicket = readCanonicalTicket({
    ticketUrl: dryRunAfterEvent.ticketUrl,
    websiteUrl: dryRunAfterEvent.websiteUrl,
    priceText: dryRunAfterEvent.priceText,
    ticketStatus: dryRunAfterEvent.ticketStatus,
    ticketPhases: dryRunAfterEvent.ticketPhases,
  });

  const consumerImpact: string[] = [];
  if (dryRunBefore.priceText !== dryRunAfter.priceText) {
    consumerImpact.push(`priceText: ${dryRunAfter.priceText ?? '—'}`);
  }
  if (dryRunBefore.ticketUrl !== dryRunAfter.ticketUrl) {
    consumerImpact.push(`ticketUrl: ${canonicalTicket.publicCtaUrl ?? dryRunAfter.ticketUrl ?? '—'}`);
  }

  const evidenceCoverage = {
    identity: Boolean(identityEvidence.pageTitle || identityEvidence.listRowTitle),
    verifiedAt: !verifiedAtMissing,
    tickets: Boolean(bundle.tickets?.priceText || bundle.tickets?.checkoutEvidenceUrl),
    description: Boolean(bundle.content?.description),
    genres: Boolean(bundle.content?.genreLabels?.length),
    lineup: lineupGate.extraction.entries.length > 0,
    checkout: Boolean(bundle.tickets?.checkoutEvidenceUrl),
    publicCta: Boolean(bundle.tickets?.publicCtaCandidateUrl),
    sourceNative: bundle.sourceNativeEvidence,
    legacyFallback: bundle.legacyFallbackUsed,
  };

  const blockReasons = [
    ...new Set([
      ...fieldGroups.flatMap((g) => g.blockReasons),
      ...Object.values(blockedGroups),
      ...(verifiedAtMissing ? ['verified_at_missing'] : []),
      ...collisionReasons,
    ]),
  ];

  return {
    eventId: input.existing.id,
    sourceId: bundle.sourceId,
    adapterId: input.adapterId,
    evidenceCoverage,
    evidenceOrigin: bundle.evidenceOrigin,
    identityEvidenceOrigin: bundle.identityEvidenceOrigin,
    sourceNativeEvidence: bundle.sourceNativeEvidence,
    legacyFallbackUsed: bundle.legacyFallbackUsed,
    criticalIdentitySelfDerived: bundle.criticalIdentitySelfDerived,
    identityVerdict: identityGate.verdict,
    identityReason: identityGate.reason,
    freshnessApply: freshness.apply,
    freshnessReason: freshness.reason,
    collision: compositeCollision || canonicalCollisionDetected || contaminationFlag,
    collisionReasons,
    collisionEventIds: collisionGuard.collisionEventIds ?? canonicalCollision.collisionEventIds,
    fieldGroups,
    fieldGroupDeltas,
    dryRunBefore,
    dryRunAfter,
    noChange,
    wouldChange,
    proposedChange,
    policyEligible,
    activationEligible,
    wouldApplyIfEnabled,
    reviewRequired,
    reviewReasons,
    autoEligible,
    consumerImpact,
    blockReasons,
    diagnostics: [
      ...identityGate.diagnostics,
      ...ticketWrite.audit.diagnostics,
      lineupGate.reason,
      collisionGuard.reason,
    ].filter(Boolean),
    rolloutMode: rollout.mode,
    writesSuppressed: rollout.writesSuppressed,
    fieldGroupEligibility,
    canonicalCollisionVerdict: canonicalCollision.verdict,
  };
}

function readString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function shouldSuppressTruthPipelineWrites(
  evaluation: GenericTruthPublishEvaluation,
  rollout: GenericTruthRolloutConfig = resolveGenericTruthRollout(),
): boolean {
  return rollout.writesSuppressed || evaluation.writesSuppressed;
}

export type { ImportPublishFieldPatch };
