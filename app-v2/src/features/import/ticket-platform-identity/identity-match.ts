import { normalizeMatchText, sameCalendarDay } from '@/features/import/matching/matching-utils';
import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';
import {
  scoreTitleCoreAgreement,
  type EventTitleCoreSecondaryEvidence,
} from '@/features/import/matching/event-title-core';

import type { EventIdentitySnapshot, PublicIdentityEvidence } from './types';

export interface IdentityMatchResult {
  match: 'exact' | 'partial' | 'mismatch' | 'unverifiable';
  reason: string;
  titleScore: number;
  dateAgrees: boolean;
  venueAgrees: boolean;
}

/** Known ticketing-shop suffixes stripped before identity comparison. */
const TICKET_PLATFORM_SHOP_TITLE_SUFFIX =
  /\s*[-–|]\s*TicketKings(?:\s*[-–|]\s*Your Ticket Kingdom)?\s*$/i;

/** Removes provider/shop chrome from an extracted public page title for identity matching. */
export function normalizeExtractedTicketPlatformPageTitle(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.replace(TICKET_PLATFORM_SHOP_TITLE_SUFFIX, '').trim();
}

function normalizeIdentityComparisonTitle(raw: string): string {
  return normalizeMatchText(
    normalizeExtractedTicketPlatformPageTitle(decodeHtmlEntities(raw.trim())),
  );
}

function tokenOverlapScore(left: string, right: string): number {
  const a = new Set(normalizeMatchText(left).split(' ').filter(Boolean));
  const b = new Set(normalizeMatchText(right).split(' ').filter(Boolean));
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  let overlap = 0;
  for (const token of a) {
    if (b.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(a.size, b.size);
}

export function venueCompatible(eventVenue: string | undefined, evidenceVenue: string | undefined): boolean {
  if (!eventVenue?.trim() || !evidenceVenue?.trim()) {
    return true;
  }
  const left = normalizeMatchText(eventVenue.split('/')[0]?.split(',')[0] ?? eventVenue);
  const right = normalizeMatchText(evidenceVenue.split('/')[0]?.split(',')[0] ?? evidenceVenue);
  if (!left || !right) {
    return true;
  }
  return left.includes(right) || right.includes(left);
}

function normalizeEvidenceTitle(title: string | undefined): string | undefined {
  if (!title?.trim()) {
    return undefined;
  }
  const normalized = normalizeExtractedTicketPlatformPageTitle(title);
  return normalized || undefined;
}

function uniqueEvidenceTitles(
  evidence: Pick<PublicIdentityEvidence, 'pageTitle' | 'listRowTitle'>,
): string[] {
  const titles: string[] = [];
  const seen = new Set<string>();
  for (const raw of [evidence.listRowTitle, evidence.pageTitle]) {
    const normalized = normalizeEvidenceTitle(raw);
    if (!normalized) {
      continue;
    }
    const key = normalizeMatchText(normalized);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    titles.push(normalized);
  }
  return titles;
}

const MATCH_RANK: Record<IdentityMatchResult['match'], number> = {
  exact: 4,
  partial: 3,
  mismatch: 2,
  unverifiable: 1,
};

function pickStrongerIdentityMatch(
  left: IdentityMatchResult,
  right: IdentityMatchResult,
): IdentityMatchResult {
  const leftRank = MATCH_RANK[left.match];
  const rightRank = MATCH_RANK[right.match];
  if (rightRank > leftRank) {
    return right;
  }
  if (rightRank < leftRank) {
    return left;
  }
  return right.titleScore > left.titleScore ? right : left;
}

function datesCompatible(
  eventStartDate: string | undefined,
  evidenceEventDate: string | undefined,
): boolean {
  if (!evidenceEventDate?.trim() || !eventStartDate?.trim()) {
    return true;
  }
  return sameCalendarDay(eventStartDate, evidenceEventDate);
}

function evaluateEvidenceTitle(
  event: EventIdentitySnapshot,
  evidence: Pick<PublicIdentityEvidence, 'eventDate' | 'venueName'>,
  evidenceTitle: string,
  secondaryEvidence?: EventTitleCoreSecondaryEvidence,
): IdentityMatchResult {
  const normalizedEventTitle = normalizeIdentityComparisonTitle(event.title);
  const normalizedEvidenceTitle = normalizeIdentityComparisonTitle(evidenceTitle);
  const titlesStructurallyIdentical = normalizedEventTitle === normalizedEvidenceTitle;
  const dateAgrees = datesCompatible(event.startDate, evidence.eventDate);
  const venueAgrees = venueCompatible(event.venueName, evidence.venueName);

  if (titlesStructurallyIdentical && dateAgrees && venueAgrees) {
    return {
      match: 'exact',
      reason: 'identical_normalized_titles',
      titleScore: 1,
      dateAgrees,
      venueAgrees,
    };
  }

  const coreScore = scoreTitleCoreAgreement(
    decodeHtmlEntities(event.title.trim()),
    decodeHtmlEntities(evidenceTitle.trim()),
    {
      ...secondaryEvidence,
      dateAgrees,
      venueCompatible: venueAgrees,
    },
    {
      left: { venueName: event.venueName },
      right: { venueName: evidence.venueName },
    },
  );
  const titleScore = coreScore.coresAgree ? coreScore.score : 0;

  if (
    coreScore.coresAgree &&
    titleScore >= 0.8 &&
    dateAgrees &&
    venueAgrees &&
    coreScore.maxMatchStrength === 'exact' &&
    titlesStructurallyIdentical
  ) {
    return {
      match: 'exact',
      reason: coreScore.comparisonReason,
      titleScore,
      dateAgrees,
      venueAgrees,
    };
  }

  if (coreScore.coresAgree && titleScore >= 0.55 && dateAgrees && venueAgrees) {
    return {
      match: 'partial',
      reason: coreScore.comparisonReason,
      titleScore,
      dateAgrees,
      venueAgrees,
    };
  }

  if (
    coreScore.coresAgree &&
    coreScore.requiresSecondaryEvidence &&
    titleScore < 0.55 &&
    dateAgrees
  ) {
    return {
      match: 'partial',
      reason: coreScore.comparisonReason,
      titleScore,
      dateAgrees,
      venueAgrees,
    };
  }

  if (titleScore >= 0.35 && dateAgrees) {
    return {
      match: 'partial',
      reason: 'partial_title_match_same_day',
      titleScore,
      dateAgrees,
      venueAgrees,
    };
  }

  if (!dateAgrees) {
    return {
      match: 'mismatch',
      reason: 'date_mismatch',
      titleScore,
      dateAgrees,
      venueAgrees,
    };
  }

  return {
    match: 'mismatch',
    reason: titleScore < 0.35 ? 'title_mismatch' : 'venue_or_title_mismatch',
    titleScore,
    dateAgrees,
    venueAgrees,
  };
}

export function evaluatePublicIdentityMatch(
  event: EventIdentitySnapshot,
  evidence: Pick<
    PublicIdentityEvidence,
    'pageTitle' | 'listRowTitle' | 'eventDate' | 'venueName'
  >,
  options?: {
    verifiedAt?: string;
    officialOutboundConfirmed?: boolean;
    slugRelationshipConfirmed?: boolean;
  },
): IdentityMatchResult {
  const evidenceTitles = uniqueEvidenceTitles(evidence);
  if (evidenceTitles.length === 0) {
    return {
      match: 'unverifiable',
      reason: 'no_public_title_evidence',
      titleScore: 0,
      dateAgrees: true,
      venueAgrees: true,
    };
  }

  const secondaryEvidence: EventTitleCoreSecondaryEvidence = {
    verifiedAt: options?.verifiedAt,
    officialOutboundConfirmed: options?.officialOutboundConfirmed,
    slugRelationshipConfirmed: options?.slugRelationshipConfirmed,
  };

  return evidenceTitles.reduce(
    (best, evidenceTitle) =>
      pickStrongerIdentityMatch(
        best,
        evaluateEvidenceTitle(event, evidence, evidenceTitle, secondaryEvidence),
      ),
    evaluateEvidenceTitle(event, evidence, evidenceTitles[0]!, secondaryEvidence),
  );
}

export function publicSourcesStructuralAgree(
  left: { eventDate?: string; venueName?: string },
  right: { eventDate?: string; venueName?: string },
  matchResult: Pick<IdentityMatchResult, 'dateAgrees'>,
): boolean {
  if (!left.eventDate?.trim() || !right.eventDate?.trim()) {
    return false;
  }
  return matchResult.dateAgrees && venueCompatible(left.venueName, right.venueName);
}

export function sameTitleDifferentDate(
  left: EventIdentitySnapshot,
  right: EventIdentitySnapshot,
): boolean {
  const coreScore = scoreTitleCoreAgreement(
    left.title,
    right.title,
    {
      dateAgrees: Boolean(
        left.startDate?.trim() &&
          right.startDate?.trim() &&
          sameCalendarDay(left.startDate, right.startDate),
      ),
      venueCompatible: venueCompatible(left.venueName, right.venueName),
    },
    {
      left: { venueName: left.venueName },
      right: { venueName: right.venueName },
    },
  );
  const titleScore = coreScore.coresAgree ? coreScore.score : 0;
  if (titleScore < 0.85) {
    return false;
  }
  if (!left.startDate || !right.startDate) {
    return false;
  }
  return !sameCalendarDay(left.startDate, right.startDate);
}
