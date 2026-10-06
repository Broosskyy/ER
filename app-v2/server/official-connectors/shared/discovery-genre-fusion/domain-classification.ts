import type { RelevanceEvidenceResult } from '../../ticket-evidence/network-discovery/relevance-evidence';
import type { DomainClassification, ImportQualificationClass } from './types';

export function classifyDomainFromRelevance(relevance: RelevanceEvidenceResult): DomainClassification {
  if (relevance.relevance === 'IRRELEVANT') {
    return 'NON_ELECTRONIC';
  }
  if (relevance.relevance === 'HIGH_RELEVANCE') {
    return 'ELECTRONIC_HIGH';
  }
  if (relevance.relevance === 'LIKELY_RELEVANT') {
    return relevance.strongPositiveHits.length > 0 ? 'ELECTRONIC_HIGH' : 'ELECTRONIC_MEDIUM';
  }
  if (relevance.relevance === 'AMBIGUOUS') {
    return relevance.strongPositiveHits.length > 0 ? 'ELECTRONIC_MEDIUM' : 'AMBIGUOUS';
  }
  return 'AMBIGUOUS';
}

export function classifyImportQualification(input: {
  relevance: RelevanceEvidenceResult;
  hasTicketBinding: boolean;
  hasOfficialBinding: boolean;
  genreCandidateCount: number;
}): ImportQualificationClass {
  const { relevance } = input;
  if (
    relevance.strongPositiveHits.length > 0 ||
    relevance.reasons.some((reason) => reason.startsWith('strong_positive:'))
  ) {
    return 'STRONG_EVENT_SPECIFIC';
  }
  if (input.genreCandidateCount > 0 || relevance.weakPositiveHits.length >= 2) {
    return 'MODERATE_EVENT_SPECIFIC';
  }
  if (
    input.hasTicketBinding &&
    relevance.relevance !== 'IRRELEVANT' &&
    relevance.weakPositiveHits.length === 0 &&
    relevance.strongPositiveHits.length === 0
  ) {
    return 'WEAK_IMPORT_QUALIFICATION';
  }
  if (relevance.relevance === 'HIGH_RELEVANCE' || relevance.relevance === 'LIKELY_RELEVANT') {
    return 'MODERATE_EVENT_SPECIFIC';
  }
  return 'UNKNOWN';
}

export function domainSupportsBroadElectronic(domain: DomainClassification): boolean {
  return domain === 'ELECTRONIC_HIGH' || domain === 'ELECTRONIC_MEDIUM';
}
