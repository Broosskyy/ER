import type { EnrichedTicketIoEvent } from '../ticket-evidence/network-discovery/detail-types';
import type { ImportQualityContractResult } from '../ticket-evidence/network-discovery/import-quality-contract-gate';
import { publishedDescriptionStructuredLeakage } from '../shared/structured-content-separation';
import type { RausgegangenLiveVerification } from './rausgegangen-controlled-import-bridge';
import { isEligibleForRausgegangenControlledImport } from './rausgegangen-controlled-import-bridge';

export type ImportEligibilityOutcome =
  | 'ELIGIBLE_NEW'
  | 'ELIGIBLE_EXISTING_MATCH'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED_RELEVANCE'
  | 'BLOCKED_DOMAIN'
  | 'BLOCKED_GENRE'
  | 'BLOCKED_IDENTITY'
  | 'BLOCKED_CONTENT'
  | 'BLOCKED_MEDIA'
  | 'BLOCKED_TICKET'
  | 'BLOCKED_OTHER';

export interface ImportEligibilityResult {
  outcome: ImportEligibilityOutcome;
  reasons: string[];
  diagnosticGateFailures: string[];
}

export const IMPORT_ELIGIBILITY_CONTRACT = {
  version: 'M9.4D',
  requiresUpcomingLifecycle: true,
  requiresRelevance: ['HIGH_RELEVANCE', 'LIKELY_RELEVANT'] as const,
  requiresElectronicDomain: ['ELECTRONIC_HIGH', 'ELECTRONIC_MEDIUM'] as const,
  requiresQualityContract: true,
  qualityReadyAloneInsufficient: true,
  ambiguousNotAutomaticallyEligible: true,
  irrelevantNeverEligible: true,
};

function isElectronicDomain(domainState: string): boolean {
  return domainState === 'ELECTRONIC_HIGH' || domainState === 'ELECTRONIC_MEDIUM';
}

function collectDiagnosticFailures(
  verification: RausgegangenLiveVerification,
  enriched: EnrichedTicketIoEvent,
  qualityContract: ImportQualityContractResult,
): string[] {
  const failures: string[] = [];
  if (!verification.liveAccessible) {
    failures.push('source_unavailable');
  }
  if (verification.relevance === 'IRRELEVANT') {
    failures.push('relevance_irrelevant');
  }
  if (verification.relevance === 'AMBIGUOUS') {
    failures.push('relevance_ambiguous');
  }
  if (!isElectronicDomain(qualityContract.domainState)) {
    failures.push(`domain:${qualityContract.domainState}`);
  }
  if (!qualityContract.passesQualityContract) {
    failures.push('quality_contract_failed');
  }
  if (qualityContract.qualityContractBypass) {
    failures.push('quality_contract_bypass');
  }
  if (qualityContract.recoverableExplicitGenreMissing > 0) {
    failures.push('recoverable_explicit_genre_missing');
  }
  if (!qualityContract.genrePresenceCoverage && enriched.genreCandidates.length > 0) {
    failures.push('genre_presence_missing');
  }
  if (publishedDescriptionStructuredLeakage(enriched.description)) {
    failures.push('structured_description_leakage');
  }
  if (verification.mediaAcceptability !== 'ACCEPTABLE_EVENT_MEDIA') {
    failures.push(`media:${verification.mediaAcceptability}`);
  }
  if (enriched.lifecycle === 'ENDED') {
    failures.push('lifecycle_ended');
  }
  return failures;
}

/**
 * First-class import eligibility: quality contract AND electronic relevance AND domain.
 * qualityReady alone is insufficient for Eternal Rave import.
 */
export function determineImportEligibility(
  verification: RausgegangenLiveVerification,
  enriched: EnrichedTicketIoEvent,
  qualityContract: ImportQualityContractResult,
  referenceInstant: Date,
): ImportEligibilityResult {
  const diagnosticGateFailures = collectDiagnosticFailures(verification, enriched, qualityContract);
  const reasons: string[] = [];

  if (!verification.liveAccessible) {
    return {
      outcome: 'BLOCKED_OTHER',
      reasons: ['not_live_accessible'],
      diagnosticGateFailures,
    };
  }
  if (
    verification.detailAccess === 'DETAIL_NOT_FOUND' ||
    verification.detailAccess === 'BLOCKED_BY_SECURITY'
  ) {
    return {
      outcome: 'BLOCKED_OTHER',
      reasons: [`detail_access:${verification.detailAccess}`],
      diagnosticGateFailures,
    };
  }
  if (enriched.lifecycle === 'ENDED') {
    return {
      outcome: 'BLOCKED_OTHER',
      reasons: ['lifecycle_ended'],
      diagnosticGateFailures,
    };
  }
  if (verification.relevance === 'IRRELEVANT') {
    return {
      outcome: 'BLOCKED_RELEVANCE',
      reasons: verification.relevanceReasons.length
        ? verification.relevanceReasons
        : ['irrelevant_relevance'],
      diagnosticGateFailures,
    };
  }
  if (verification.relevance === 'AMBIGUOUS') {
    return {
      outcome: 'BLOCKED_RELEVANCE',
      reasons: ['ambiguous_relevance', ...verification.relevanceReasons],
      diagnosticGateFailures,
    };
  }
  if (!isElectronicDomain(qualityContract.domainState)) {
    return {
      outcome: 'BLOCKED_DOMAIN',
      reasons: [`domain:${qualityContract.domainState}`],
      diagnosticGateFailures,
    };
  }
  if (verification.mediaAcceptability !== 'ACCEPTABLE_EVENT_MEDIA') {
    return {
      outcome: 'BLOCKED_MEDIA',
      reasons: [verification.mediaAcceptability],
      diagnosticGateFailures,
    };
  }
  if (qualityContract.recoverableExplicitGenreMissing > 0) {
    return {
      outcome: 'BLOCKED_GENRE',
      reasons: ['recoverable_explicit_genre_missing'],
      diagnosticGateFailures,
    };
  }
  if (!qualityContract.genrePresenceCoverage && enriched.genreCandidates.length > 0) {
    return {
      outcome: 'BLOCKED_GENRE',
      reasons: ['genre_presence_missing'],
      diagnosticGateFailures,
    };
  }
  if (publishedDescriptionStructuredLeakage(enriched.description)) {
    return {
      outcome: 'BLOCKED_CONTENT',
      reasons: ['structured_description_leakage'],
      diagnosticGateFailures,
    };
  }
  if (!qualityContract.passesQualityContract || qualityContract.qualityContractBypass) {
    return {
      outcome: 'BLOCKED_CONTENT',
      reasons: qualityContract.reviewReasons.length
        ? qualityContract.reviewReasons
        : ['quality_contract_failed'],
      diagnosticGateFailures,
    };
  }

  const eligibility = isEligibleForRausgegangenControlledImport(verification, referenceInstant);
  if (!eligibility.eligible) {
    const relevanceBlock = eligibility.reasons.find((reason) => reason.startsWith('relevance:'));
    if (relevanceBlock) {
      return {
        outcome: 'BLOCKED_RELEVANCE',
        reasons: eligibility.reasons,
        diagnosticGateFailures,
      };
    }
    if (eligibility.reasons.some((reason) => reason.includes('media'))) {
      return {
        outcome: 'BLOCKED_MEDIA',
        reasons: eligibility.reasons,
        diagnosticGateFailures,
      };
    }
    return {
      outcome: 'BLOCKED_OTHER',
      reasons: eligibility.reasons,
      diagnosticGateFailures,
    };
  }

  if (
    verification.matchClassification === 'EXISTING_EXACT' ||
    verification.matchClassification === 'EXISTING_STRONG_MATCH'
  ) {
    return {
      outcome: 'ELIGIBLE_EXISTING_MATCH',
      reasons: verification.matchReasons,
      diagnosticGateFailures,
    };
  }
  if (
    verification.matchClassification === 'POSSIBLE_MATCH' ||
    verification.matchClassification === 'REVIEW_REQUIRED'
  ) {
    return {
      outcome: 'REVIEW_REQUIRED',
      reasons: verification.matchReasons,
      diagnosticGateFailures,
    };
  }

  return {
    outcome: 'ELIGIBLE_NEW',
    reasons: [],
    diagnosticGateFailures,
  };
}

export function isImportEligibleOutcome(outcome: ImportEligibilityOutcome): boolean {
  return outcome === 'ELIGIBLE_NEW' || outcome === 'ELIGIBLE_EXISTING_MATCH';
}

export function passesImportEligibilityFromSnapshot(
  relevance: string | undefined,
  domainState: string | undefined,
  passesQualityContract: boolean,
): boolean {
  const relevanceOk =
    relevance === 'HIGH_RELEVANCE' || relevance === 'LIKELY_RELEVANT';
  const domainOk = domainState ? isElectronicDomain(domainState) : false;
  return Boolean(relevanceOk && domainOk && passesQualityContract);
}
