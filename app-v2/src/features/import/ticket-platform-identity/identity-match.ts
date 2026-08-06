import { normalizeMatchText, sameCalendarDay } from '@/features/import/matching/matching-utils';

import type { EventIdentitySnapshot, PublicIdentityEvidence } from './types';

export interface IdentityMatchResult {
  match: 'exact' | 'partial' | 'mismatch' | 'unverifiable';
  reason: string;
  titleScore: number;
  dateAgrees: boolean;
  venueAgrees: boolean;
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

function venueCompatible(eventVenue: string | undefined, evidenceVenue: string | undefined): boolean {
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

export function evaluatePublicIdentityMatch(
  event: EventIdentitySnapshot,
  evidence: Pick<
    PublicIdentityEvidence,
    'pageTitle' | 'listRowTitle' | 'eventDate' | 'venueName'
  >,
): IdentityMatchResult {
  const evidenceTitle = evidence.listRowTitle ?? evidence.pageTitle;
  if (!evidenceTitle?.trim()) {
    return {
      match: 'unverifiable',
      reason: 'no_public_title_evidence',
      titleScore: 0,
      dateAgrees: true,
      venueAgrees: true,
    };
  }

  const titleScore = tokenOverlapScore(event.title, evidenceTitle);
  const dateAgrees = evidence.eventDate
    ? sameCalendarDay(event.startDate ?? '', evidence.eventDate)
    : true;
  const venueAgrees = venueCompatible(event.venueName, evidence.venueName);

  if (titleScore >= 0.55 && dateAgrees && venueAgrees) {
    return {
      match: 'exact',
      reason: 'title_date_venue_compatible',
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

export function sameTitleDifferentDate(
  left: EventIdentitySnapshot,
  right: EventIdentitySnapshot,
): boolean {
  const titleScore = tokenOverlapScore(left.title, right.title);
  if (titleScore < 0.85) {
    return false;
  }
  if (!left.startDate || !right.startDate) {
    return false;
  }
  return !sameCalendarDay(left.startDate, right.startDate);
}
