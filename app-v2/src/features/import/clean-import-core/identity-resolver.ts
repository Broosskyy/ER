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

import { isConcreteEventUrl, normalizePublicUrl } from './cross-source-event-resolver';
import type { EventEvidence } from './event-evidence';

export type CleanIdentityVerdict =
  | 'exact'
  | 'corroborated'
  | 'mismatch'
  | 'unverifiable'
  | 'duplicate_candidate';

export interface IdentityResolution {
  verdict: CleanIdentityVerdict;
  /** Primary verified public identity source for canonical assembly. */
  identityAnchor?: EventEvidence;
  identityMode?: 'official_website' | 'ticket_platform';
  /** Present when the anchor is an official website contribution. */
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


function concreteEventUrl(evidence: EventEvidence): string | undefined {
  if (evidence.sourceFamily === 'official_website') {
    return evidence.identity.officialWebsiteUrl?.value ?? evidence.sourceUrl;
  }
  return evidence.tickets.publicTicketUrl?.value ?? evidence.sourceUrl;
}

function evidenceVenue(evidence: EventEvidence): string | undefined {
  return evidence.identity.venueName?.value ?? evidence.identity.locationText?.value;
}

/** Verified public identity from one concrete event page or ticket event card. */
export function hasStablePublicIdentity(evidence: EventEvidence): boolean {
  const title = evidence.identity.title?.value?.trim();
  const startDate = evidence.identity.startDate?.value?.trim();
  const venueName = evidence.identity.venueName?.value?.trim();
  const verifiedAt = evidence.verifiedAt?.trim();
  const eventUrl = concreteEventUrl(evidence);
  if (!title || !startDate || !venueName || !verifiedAt || !eventUrl) {
    return false;
  }
  if (!isConcreteEventUrl(eventUrl)) {
    return false;
  }
  const titleCore = analyzeEventTitleCore(title, { venueName });
  return titleCore.coreTokens.length > 0;
}

export function missingStableIdentityReasons(evidence: EventEvidence[]): string[] {
  const reasons = new Set<string>();
  for (const entry of evidence) {
    if (!entry.identity.title?.value?.trim()) reasons.add('title_missing');
    if (!entry.identity.startDate?.value?.trim()) reasons.add('start_date_missing');
    if (!entry.identity.venueName?.value?.trim()) reasons.add('venue_missing');
    if (!entry.verifiedAt?.trim()) reasons.add('verified_at_missing');
    const url = concreteEventUrl(entry);
    if (!url || !isConcreteEventUrl(url)) reasons.add('event_url_missing');
  }
  if (reasons.size === 0) {
    reasons.add('stable_identity_unverifiable');
  }
  return [...reasons];
}

function corroborateAgainstAnchor(
  anchor: EventEvidence,
  candidate: EventEvidence,
): {
  accepted: boolean;
  verdict: 'exact' | 'corroborated' | 'mismatch' | 'unverifiable';
  reason: string;
} {
  const anchorTitle = anchor.identity.title?.value;
  const candidateTitle = candidate.identity.title?.value;
  const anchorDate = anchor.identity.startDate?.value;
  const candidateDate = candidate.identity.startDate?.value;
  const anchorVenue = evidenceVenue(anchor);
  const candidateVenue = evidenceVenue(candidate);
  const candidateTicketUrl = candidate.tickets.publicTicketUrl?.value;
  const anchorTicketUrl = anchor.tickets.publicTicketUrl?.value;

  if (
    !candidate.verifiedAt ||
    !anchorTitle ||
    !candidateTitle ||
    !anchorDate ||
    !candidateDate ||
    !anchorVenue ||
    !candidateVenue
  ) {
    return {
      accepted: false,
      verdict: 'unverifiable',
      reason: `identity_unverifiable:${candidate.sourceId}`,
    };
  }

  const compatibility = evaluateSourceNativeIdentityCompatibility(
    { title: anchorTitle, startDate: anchorDate, venueName: anchorVenue },
    { title: candidateTitle, startDate: candidateDate, venueName: candidateVenue },
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
    normalizeMatchText(anchorTitle) === normalizeMatchText(candidateTitle);
  if (structurallyExact) {
    return {
      accepted: true,
      verdict: 'exact',
      reason: `identity_exact:${candidate.sourceId}`,
    };
  }

  if (anchor.sourceFamily === 'official_website' && candidate.sourceFamily !== 'official_website') {
    const outbound = resolveOfficialOutboundRelationship({
      publicTicketPageUrl: candidateTicketUrl,
      outboundTicketUrls: anchor.identity.outboundTicketUrls,
    });
    if (outbound.confirmed) {
      return {
        accepted: true,
        verdict: 'corroborated',
        reason: `identity_corroborated:${candidate.sourceId}`,
      };
    }
  }

  if (anchor.sourceFamily !== 'official_website' && candidate.sourceFamily === 'official_website') {
    const outbound = resolveOfficialOutboundRelationship({
      publicTicketPageUrl: anchorTicketUrl,
      outboundTicketUrls: candidate.identity.outboundTicketUrls,
    });
    if (outbound.confirmed) {
      return {
        accepted: true,
        verdict: 'corroborated',
        reason: `identity_corroborated:${candidate.sourceId}`,
      };
    }
  }

  if (
    anchor.sourceFamily !== 'official_website' &&
    candidate.sourceFamily !== 'official_website' &&
    candidateTicketUrl &&
    anchorTicketUrl &&
    candidateTicketUrl === anchorTicketUrl
  ) {
    return {
      accepted: true,
      verdict: 'corroborated',
      reason: `identity_corroborated:${candidate.sourceId}`,
    };
  }

  return {
    accepted: false,
    verdict: 'unverifiable',
    reason: `identity_partial_without_corroboration:${candidate.sourceId}`,
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

    const stableCandidates = evidence.filter(hasStablePublicIdentity);
    if (stableCandidates.length === 0) {
      return {
        verdict: 'unverifiable',
        acceptedEvidence: [],
        isolatedEvidence: evidence,
        reasons: missingStableIdentityReasons(evidence),
      };
    }

    for (let index = 0; index < stableCandidates.length; index += 1) {
      for (let other = index + 1; other < stableCandidates.length; other += 1) {
        const left = stableCandidates[index]!;
        const right = stableCandidates[other]!;
        const leftUrl = normalizePublicUrl(concreteEventUrl(left));
        const rightUrl = normalizePublicUrl(concreteEventUrl(right));
        if (!leftUrl || !rightUrl || leftUrl !== rightUrl) {
          continue;
        }
        const compatibility = evaluateSourceNativeIdentityCompatibility(
          {
            title: left.identity.title?.value,
            startDate: left.identity.startDate?.value,
            venueName: evidenceVenue(left),
          },
          {
            title: right.identity.title?.value,
            startDate: right.identity.startDate?.value,
            venueName: evidenceVenue(right),
          },
        );
        const conflict = compatibility.reasons.find((reason) =>
          ['title_mismatch', 'date_mismatch', 'venue_mismatch'].includes(reason),
        );
        if (conflict) {
          return {
            verdict: 'mismatch',
            acceptedEvidence: [],
            isolatedEvidence: evidence,
            reasons: [`cluster_identity_${conflict}`],
          };
        }
      }
    }

    const officialAnchor = stableCandidates.find(
      (entry) => entry.sourceFamily === 'official_website',
    );
    const ticketAnchor = stableCandidates.find(
      (entry) => entry.sourceFamily !== 'official_website',
    );
    const anchor = officialAnchor ?? ticketAnchor!;
    const identityMode: IdentityResolution['identityMode'] =
      anchor.sourceFamily === 'official_website' ? 'official_website' : 'ticket_platform';
    const official = officialAnchor;

    const acceptedEvidence = [anchor];
    const isolatedEvidence: EventEvidence[] = [];
    const reasons: string[] = [];
    let acceptedTicketVerdict: 'exact' | 'corroborated' | undefined;
    let hasTicketMismatch = false;

    for (const candidate of evidence) {
      if (candidate === anchor) {
        continue;
      }
      const comparison = corroborateAgainstAnchor(anchor, candidate);
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
        if (
          candidate.sourceFamily === 'official_website' &&
          comparison.verdict === 'mismatch'
        ) {
          return {
            verdict: comparison.verdict,
            identityAnchor: anchor,
            identityMode,
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
        identityAnchor: anchor,
        identityMode,
        official,
        acceptedEvidence,
        isolatedEvidence,
        reasons,
      };
    }

    return {
      verdict: acceptedTicketVerdict ?? 'exact',
      identityAnchor: anchor,
      identityMode,
      official,
      acceptedEvidence,
      isolatedEvidence,
      reasons,
    };
  }
}
