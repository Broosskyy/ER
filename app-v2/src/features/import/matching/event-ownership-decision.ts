import type { KnownEventForDuplicateCheck } from '@/features/import/matching/match-result';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import {
  normalizeMatchText,
  sameCalendarDay,
  tokenSimilarity,
} from '@/features/import/matching/matching-utils';
import { normalizeTicketIoEventUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';

export const EVENT_OWNERSHIP_MATCHER_VERSION = 'phase4691';

export type OwnershipStrongSignal =
  | 'source_reference'
  | 'external_id_match'
  | 'fingerprint_match'
  | 'ticket_url_match'
  | 'official_event_url_match'
  | 'title_date_venue_match'
  | 'explicit_cross_link';

export type OwnershipConflictSignal =
  | 'external_id_conflict'
  | 'ticket_url_conflict'
  | 'official_url_conflict'
  | 'date_conflict'
  | 'title_conflict_severe';

export interface EventOwnershipDecision {
  candidateEventId?: string;
  accepted: boolean;
  score: number;
  strongSignals: OwnershipStrongSignal[];
  supportingSignals: string[];
  conflictSignals: OwnershipConflictSignal[];
  decisionReason: string;
  matcherVersion: string;
  requiresReview: boolean;
}

function normalizeTicketUrl(url: string | undefined): string | undefined {
  if (!url?.trim()) {
    return undefined;
  }
  const ticketIo = normalizeTicketIoEventUrl(url);
  if (ticketIo) {
    return ticketIo;
  }
  try {
    const parsed = new URL(url.trim());
    if (parsed.hostname.toLowerCase().includes('ticketkings.de')) {
      const path = parsed.pathname.replace(/\/+$/, '') || '/';
      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${path}`;
    }
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '') || '/'}`;
  } catch {
    return undefined;
  }
}

function collectComparableUrls(candidate: NormalizedEventCandidate): string[] {
  return [candidate.ticketUrl, candidate.externalId, candidate.eventUrl, candidate.originalLink].filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0,
  );
}

function collectEventUrls(event: KnownEventForDuplicateCheck): string[] {
  return [event.ticketUrl, event.externalId, event.eventUrl].filter(
    (url): url is string => typeof url === 'string' && url.trim().length > 0,
  );
}

function hasTicketUrlConflict(
  candidate: NormalizedEventCandidate,
  event: KnownEventForDuplicateCheck,
): boolean {
  const candidateUrls = collectComparableUrls(candidate)
    .map(normalizeTicketUrl)
    .filter((url): url is string => Boolean(url));
  const eventUrls = collectEventUrls(event)
    .map(normalizeTicketUrl)
    .filter((url): url is string => Boolean(url));
  if (candidateUrls.length === 0 || eventUrls.length === 0) {
    return false;
  }
  const candidateSet = new Set(candidateUrls);
  return !eventUrls.some((url) => candidateSet.has(url));
}

function isResolvableEventUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function hasExternalIdConflict(
  candidate: NormalizedEventCandidate,
  event: KnownEventForDuplicateCheck,
): boolean {
  if (!candidate.externalId || !event.externalId) {
    return false;
  }
  if (!isResolvableEventUrl(candidate.externalId) || !isResolvableEventUrl(event.externalId)) {
    return false;
  }
  const candidateUrl = normalizeTicketUrl(candidate.externalId);
  const eventUrl = normalizeTicketUrl(event.externalId);
  if (!candidateUrl || !eventUrl) {
    return false;
  }
  return candidateUrl !== eventUrl;
}

export function evaluateEventOwnershipMatch(input: {
  candidate: NormalizedEventCandidate;
  event: KnownEventForDuplicateCheck;
  matchedVenueId?: string;
  hasSourceReference?: boolean;
  hasFingerprintMatch?: boolean;
}): EventOwnershipDecision {
  const { candidate, event } = input;
  const strongSignals: OwnershipStrongSignal[] = [];
  const supportingSignals: string[] = [];
  const conflictSignals: OwnershipConflictSignal[] = [];

  if (!sameCalendarDay(candidate.startDate, event.startDate)) {
    conflictSignals.push('date_conflict');
    return {
      candidateEventId: event.id,
      accepted: false,
      score: 0,
      strongSignals,
      supportingSignals,
      conflictSignals,
      decisionReason: 'Calendar day mismatch rejects ownership.',
      matcherVersion: EVENT_OWNERSHIP_MATCHER_VERSION,
      requiresReview: false,
    };
  }

  const titleScore = tokenSimilarity(candidate.title, event.title);

  if (hasExternalIdConflict(candidate, event)) {
    conflictSignals.push('external_id_conflict');
  }
  if (hasTicketUrlConflict(candidate, event) && titleScore < 80) {
    conflictSignals.push('ticket_url_conflict');
  }

  if (
    candidate.eventUrl &&
    event.eventUrl &&
    normalizeMatchText(candidate.eventUrl) !== normalizeMatchText(event.eventUrl) &&
    titleScore < 85
  ) {
    conflictSignals.push('official_url_conflict');
  }

  const hardConflict = conflictSignals.some((signal) => signal !== 'title_conflict_severe');
  if (titleScore < 45) {
    conflictSignals.push('title_conflict_severe');
  }

  if (hardConflict || (conflictSignals.includes('title_conflict_severe') && titleScore < 45)) {
    return {
      candidateEventId: event.id,
      accepted: false,
      score: 0,
      strongSignals,
      supportingSignals,
      conflictSignals,
      decisionReason: `Ownership rejected due to conflicts: ${conflictSignals.join(', ')}.`,
      matcherVersion: EVENT_OWNERSHIP_MATCHER_VERSION,
      requiresReview: true,
    };
  }

  let score = 0;

  if (input.hasSourceReference) {
    strongSignals.push('source_reference');
    score = Math.max(score, 100);
  }

  if (
    candidate.externalId &&
    event.externalId &&
    normalizeMatchText(candidate.externalId) === normalizeMatchText(event.externalId)
  ) {
    strongSignals.push('external_id_match');
    score = Math.max(score, 100);
  }

  if (input.hasFingerprintMatch) {
    strongSignals.push('fingerprint_match');
    score = Math.max(score, 95);
  }

  const candidateUrls = collectComparableUrls(candidate).map(normalizeTicketUrl).filter(Boolean);
  const eventUrls = collectEventUrls(event).map(normalizeTicketUrl).filter(Boolean);
  if (
    candidateUrls.length > 0 &&
    eventUrls.length > 0 &&
    candidateUrls.some((left) => eventUrls.includes(left))
  ) {
    strongSignals.push('ticket_url_match');
    score = Math.max(score, 95);
  }

  const incomingUrl = candidate.eventUrl ?? candidate.originalLink;
  if (incomingUrl && event.eventUrl && incomingUrl === event.eventUrl) {
    strongSignals.push('official_event_url_match');
    score = Math.max(score, 90);
  }

  if (titleScore >= 70) {
    supportingSignals.push(`title_similarity:${titleScore}`);
    score = Math.max(score, titleScore);
  }

  if (
    input.matchedVenueId &&
    event.venueId &&
    input.matchedVenueId === event.venueId &&
    titleScore >= 80
  ) {
    strongSignals.push('title_date_venue_match');
    score = Math.max(score, 95);
  } else if (
    candidate.venueName &&
    event.venueName &&
    tokenSimilarity(candidate.venueName, event.venueName) >= 85 &&
    titleScore >= 80
  ) {
    strongSignals.push('title_date_venue_match');
    score = Math.max(score, 95);
  }

  const candidateArtists = candidate.artistNames ?? [];
  const eventArtists = event.artistNames ?? [];
  if (candidateArtists.length > 0 && eventArtists.length > 0 && titleScore >= 60) {
    let bestArtistScore = 0;
    for (const artist of candidateArtists) {
      for (const eventArtist of eventArtists) {
        bestArtistScore = Math.max(bestArtistScore, tokenSimilarity(artist, eventArtist));
      }
    }
    if (bestArtistScore >= 85) {
      supportingSignals.push(`artist_overlap:${bestArtistScore}`);
      if (strongSignals.length > 0) {
        score = Math.min(100, score + 8);
      }
    }
  }

  const accepted = strongSignals.length > 0 && score >= 70;
  const requiresReview = !accepted && score >= 55;

  return {
    candidateEventId: event.id,
    accepted,
    score,
    strongSignals,
    supportingSignals,
    conflictSignals,
    decisionReason: accepted
      ? `Ownership accepted with strong signals: ${strongSignals.join(', ')}.`
      : requiresReview
        ? 'Ambiguous ownership requires review; insufficient strong signals.'
        : 'Ownership rejected; no strong signal and score below threshold.',
    matcherVersion: EVENT_OWNERSHIP_MATCHER_VERSION,
    requiresReview,
  };
}

/** Returns true when an import record may contribute lineup to the canonical event. */
export function importRecordMayContributeLineup(input: {
  recordTitle: string;
  recordExternalUrls: string[];
  eventTitle: string;
  eventTicketUrl?: string;
  eventWebsiteUrl?: string;
}): boolean {
  const titleScore = tokenSimilarity(input.recordTitle, input.eventTitle);
  if (titleScore < 50) {
    return false;
  }

  const eventUrls = [input.eventTicketUrl, input.eventWebsiteUrl]
    .map(normalizeTicketUrl)
    .filter((url): url is string => Boolean(url));
  const recordUrls = input.recordExternalUrls.map(normalizeTicketUrl).filter((url): url is string => Boolean(url));

  if (recordUrls.length > 0 && eventUrls.length > 0) {
    const eventUrlSet = new Set(eventUrls);
    if (!recordUrls.some((url) => eventUrlSet.has(url))) {
      return titleScore >= 85;
    }
  }

  return titleScore >= 50;
}
