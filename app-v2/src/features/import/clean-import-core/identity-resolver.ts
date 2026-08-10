import {
  analyzeEventTitleCore,
  compareEventTitleCores,
} from '@/features/import/matching/event-title-core';
import {
  normalizeMatchText,
  sameCalendarDay,
} from '@/features/import/matching/matching-utils';
import { resolveOfficialOutboundRelationship } from '@/features/import/domain/official-page-ticket-corroboration';
import { venueCompatible } from '@/features/import/ticket-platform-identity/identity-match';

import type { EventEvidence } from './event-evidence';

export type CleanIdentityVerdict =
  | 'exact'
  | 'corroborated'
  | 'mismatch'
  | 'unverifiable'
  | 'duplicate_candidate';

export interface IdentityResolution {
  verdict: CleanIdentityVerdict;
  official?: EventEvidence;
  acceptedEvidence: EventEvidence[];
  isolatedEvidence: EventEvidence[];
  reasons: string[];
}

export interface SourceNativeIdentity {
  title?: string;
  startDate?: string;
  venueName?: string;
  locationText?: string;
  organizerName?: string;
}

export interface SourceNativeIdentityCompatibility {
  compatible: boolean;
  reasons: Array<'title_missing' | 'date_missing' | 'title_mismatch' | 'date_mismatch' | 'venue_mismatch'>;
}

/**
 * Guards source mappings and clustering with source-native identity only.
 * Organizer equality is intentionally not considered evidence of event identity.
 */
export function evaluateSourceNativeIdentityCompatibility(
  left: SourceNativeIdentity,
  right: SourceNativeIdentity,
): SourceNativeIdentityCompatibility {
  const reasons: SourceNativeIdentityCompatibility['reasons'] = [];
  if (!left.title?.trim() || !right.title?.trim()) {
    reasons.push('title_missing');
  }
  if (!left.startDate?.trim() || !right.startDate?.trim()) {
    reasons.push('date_missing');
  }
  if (reasons.length > 0) {
    return { compatible: false, reasons };
  }

  const leftVenue = left.venueName ?? left.locationText;
  const rightVenue = right.venueName ?? right.locationText;
  const titleComparison = compareEventTitleCores(
    analyzeEventTitleCore(left.title!, { venueName: leftVenue }),
    analyzeEventTitleCore(right.title!, { venueName: rightVenue }),
  );
  if (!titleComparison.coresAgree) {
    reasons.push('title_mismatch');
  }
  if (!sameCalendarDay(left.startDate!, right.startDate!)) {
    reasons.push('date_mismatch');
  }
  if (leftVenue?.trim() && rightVenue?.trim() && !venueCompatible(leftVenue, rightVenue)) {
    reasons.push('venue_mismatch');
  }
  return { compatible: reasons.length === 0, reasons };
}

function hasCompleteOfficialIdentity(evidence: EventEvidence): boolean {
  return Boolean(
    evidence.verifiedAt &&
      evidence.identity.title?.value.trim() &&
      evidence.identity.startDate?.value.trim() &&
      (evidence.identity.venueName?.value.trim() ||
        evidence.identity.locationText?.value.trim()) &&
      evidence.identity.officialWebsiteUrl?.value.trim(),
  );
}

function evidenceVenue(evidence: EventEvidence): string | undefined {
  return evidence.identity.venueName?.value ?? evidence.identity.locationText?.value;
}

function identityPair(
  official: EventEvidence,
  candidate: EventEvidence,
): {
  accepted: boolean;
  verdict: 'exact' | 'corroborated' | 'mismatch' | 'unverifiable';
  reason: string;
} {
  const officialTitle = official.identity.title?.value;
  const candidateTitle = candidate.identity.title?.value;
  const officialDate = official.identity.startDate?.value;
  const candidateDate = candidate.identity.startDate?.value;
  const officialVenue = evidenceVenue(official);
  const candidateVenue = evidenceVenue(candidate);
  const publicTicketUrl = candidate.tickets.publicTicketUrl?.value;

  if (
    !candidate.verifiedAt ||
    !officialTitle ||
    !candidateTitle ||
    !officialDate ||
    !candidateDate ||
    !officialVenue ||
    !candidateVenue ||
    (candidate.sourceFamily !== 'official_website' && !publicTicketUrl)
  ) {
    return {
      accepted: false,
      verdict: 'unverifiable',
      reason: `identity_unverifiable:${candidate.sourceId}`,
    };
  }

  const compatibility = evaluateSourceNativeIdentityCompatibility(
    {
      title: officialTitle,
      startDate: officialDate,
      venueName: officialVenue,
    },
    {
      title: candidateTitle,
      startDate: candidateDate,
      venueName: candidateVenue,
    },
  );

  if (compatibility.reasons.includes('date_mismatch')) {
    return {
      accepted: false,
      verdict: 'mismatch',
      reason: `identity_date_mismatch:${candidate.sourceId}`,
    };
  }
  if (compatibility.reasons.includes('venue_mismatch')) {
    return {
      accepted: false,
      verdict: 'mismatch',
      reason: `identity_venue_mismatch:${candidate.sourceId}`,
    };
  }
  if (compatibility.reasons.includes('title_mismatch')) {
    return {
      accepted: false,
      verdict: 'mismatch',
      reason: `identity_title_mismatch:${candidate.sourceId}`,
    };
  }

  const structurallyExact =
    normalizeMatchText(officialTitle) === normalizeMatchText(candidateTitle);
  if (structurallyExact) {
    return {
      accepted: true,
      verdict: 'exact',
      reason: `identity_exact:${candidate.sourceId}`,
    };
  }

  const outbound = resolveOfficialOutboundRelationship({
    publicTicketPageUrl: publicTicketUrl,
    outboundTicketUrls: official.identity.outboundTicketUrls,
  });
  if (outbound.confirmed) {
    return {
      accepted: true,
      verdict: 'corroborated',
      reason: `identity_corroborated:${candidate.sourceId}`,
    };
  }

  return {
    accepted: false,
    verdict: 'unverifiable',
    reason: `identity_partial_without_outbound:${candidate.sourceId}`,
  };
}

export class IdentityResolver {
  resolve(evidence: EventEvidence[]): IdentityResolution {
    if (evidence.some((entry) => entry.duplicateCandidate)) {
      return {
        verdict: 'duplicate_candidate',
        acceptedEvidence: [],
        isolatedEvidence: evidence,
        reasons: ['duplicate_candidate'],
      };
    }

    const officialCandidates = evidence.filter(
      (entry) =>
        entry.sourceFamily === 'official_website' &&
        hasCompleteOfficialIdentity(entry),
    );
    const official = officialCandidates[0];
    if (!official) {
      return {
        verdict: 'unverifiable',
        acceptedEvidence: [],
        isolatedEvidence: evidence,
        reasons: ['official_identity_missing_or_unverified'],
      };
    }

    const acceptedEvidence = [official];
    const isolatedEvidence: EventEvidence[] = [];
    const reasons: string[] = [];
    let acceptedTicketVerdict: 'exact' | 'corroborated' | undefined;
    let hasTicketMismatch = false;

    for (const candidate of evidence) {
      if (candidate === official) {
        continue;
      }
      const comparison = identityPair(official, candidate);
      reasons.push(comparison.reason);
      if (comparison.accepted) {
        acceptedEvidence.push(candidate);
        if (candidate.sourceFamily !== 'official_website') {
          acceptedTicketVerdict =
            acceptedTicketVerdict === 'exact' || comparison.verdict === 'exact'
              ? 'exact'
              : 'corroborated';
        }
      } else {
        isolatedEvidence.push(candidate);
        if (
          candidate.sourceFamily !== 'official_website' &&
          comparison.verdict === 'mismatch'
        ) {
          hasTicketMismatch = true;
        }
        if (candidate.sourceFamily === 'official_website') {
          return {
            verdict: comparison.verdict,
            official,
            acceptedEvidence,
            isolatedEvidence,
            reasons,
          };
        }
      }
    }

    const ticketEvidence = evidence.filter(
      (entry) => entry.sourceFamily !== 'official_website',
    );
    if (ticketEvidence.length > 0 && !acceptedTicketVerdict && hasTicketMismatch) {
      return {
        verdict: 'mismatch',
        official,
        acceptedEvidence,
        isolatedEvidence,
        reasons,
      };
    }

    return {
      verdict: acceptedTicketVerdict ?? 'exact',
      official,
      acceptedEvidence,
      isolatedEvidence,
      reasons,
    };
  }
}
