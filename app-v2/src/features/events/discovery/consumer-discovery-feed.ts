import type { EventSummary } from '@/features/events/types/event-core';

import {
  classifyConsumerEventLifecycle,
  isDiscoverableConsumerLifecycle,
} from '../../../../shared/consumer-event-lifecycle';
import {
  calendarDayKey,
  canonicalTicketUrlForCompare,
  normalizeEventTitle,
  startTimeDeltaMs,
  titleSimilarity,
} from '../../../../shared/match-normalizers';

export interface ConsumerDiscoveryFeedOptions {
  referenceInstant?: Date;
}

export interface ConsumerDuplicateGroup {
  confidence: 'high' | 'ambiguous';
  eventIds: string[];
  titles: string[];
  winnerId: string;
}

export interface ConsumerDiscoveryFeedResult {
  events: EventSummary[];
  canonicalAliases: Map<string, string>;
  duplicateGroups: ConsumerDuplicateGroup[];
}

const STRONG_TITLE_THRESHOLD = 0.85;
const AMBIGUOUS_TITLE_THRESHOLD = 0.72;
const STRONG_START_DRIFT_MS = 2 * 60 * 60 * 1000;

function eventVenueKey(event: EventSummary): string | null {
  if (!event.venue) {
    return null;
  }
  return [event.venue.id, event.venue.city ?? '', event.venue.name ?? ''].join('|');
}

function officialUrlCanonicalScore(officialUrl: string | null | undefined): number {
  if (!officialUrl?.trim()) {
    return 0;
  }
  const slug = officialUrl.split('/').filter(Boolean).pop() ?? '';
  let score = 0;
  if (/^\d{1,2}-\d{1,2}-\d{2}-/.test(slug)) {
    score += 3;
  }
  const titleTokens = normalizeEventTitle(
    slug.replace(/^\d{1,2}-\d{1,2}-\d{2}-/, '').replace(/-/g, ' '),
  )
    .split(' ')
    .filter(Boolean);
  score += titleTokens.length > 0 ? 1 : 0;
  return score;
}

function eventEvidenceScore(event: EventSummary): number {
  let score = 0;
  if (event.title.trim().length > 0) {
    score += 1;
  }
  if (event.imageUrl) {
    score += 2;
  }
  if (event.primaryTicket?.priceFromMinor != null) {
    score += 3;
  }
  if (event.primaryTicket?.ticketUrl) {
    score += 1;
  }
  if (event.genres.length > 0) {
    score += 1;
  }
  score += officialUrlCanonicalScore(event.officialUrl);
  return score;
}

function pickCanonicalWinner(left: EventSummary, right: EventSummary): EventSummary {
  const leftScore = eventEvidenceScore(left);
  const rightScore = eventEvidenceScore(right);
  if (leftScore !== rightScore) {
    return leftScore > rightScore ? left : right;
  }
  if (left.title.length !== right.title.length) {
    return left.title.length > right.title.length ? left : right;
  }
  return left.id > right.id ? left : right;
}

export function assessConsumerDuplicatePair(
  left: EventSummary,
  right: EventSummary,
): { confidence: 'high' | 'ambiguous' | 'none'; reasons: string[] } {
  const reasons: string[] = [];
  const timezone = left.timezone ?? right.timezone ?? 'Europe/Berlin';
  const sameDay =
    calendarDayKey(left.startsAt, timezone) != null &&
    calendarDayKey(left.startsAt, timezone) === calendarDayKey(right.startsAt, timezone);
  const sameVenue = eventVenueKey(left) != null && eventVenueKey(left) === eventVenueKey(right);
  const titleScore = titleSimilarity(left.title, right.title);
  const drift = startTimeDeltaMs(left.startsAt, right.startsAt);
  const sameTicketUrl =
    canonicalTicketUrlForCompare(left.primaryTicket?.ticketUrl) != null &&
    canonicalTicketUrlForCompare(left.primaryTicket?.ticketUrl) ===
      canonicalTicketUrlForCompare(right.primaryTicket?.ticketUrl);

  if (!sameDay || !sameVenue) {
    return { confidence: 'none', reasons: ['different_day_or_venue'] };
  }

  if (titleScore < AMBIGUOUS_TITLE_THRESHOLD) {
    return { confidence: 'none', reasons: ['title_similarity_too_low'] };
  }

  const alignedStart = drift != null && drift <= STRONG_START_DRIFT_MS;
  if (sameTicketUrl && !alignedStart) {
    reasons.push('shared_ticket_url_with_different_start');
  }

  if (sameTicketUrl && titleScore >= AMBIGUOUS_TITLE_THRESHOLD) {
    reasons.push('shared_ticket_url_with_title_evidence');
    return {
      confidence: titleScore >= STRONG_TITLE_THRESHOLD && alignedStart ? 'high' : 'ambiguous',
      reasons,
    };
  }

  if (titleScore >= STRONG_TITLE_THRESHOLD && alignedStart) {
    reasons.push('same_day_venue_title_start');
    return { confidence: 'high', reasons };
  }

  if (titleScore >= AMBIGUOUS_TITLE_THRESHOLD && alignedStart) {
    reasons.push('possible_title_typo_same_slot');
    return { confidence: 'ambiguous', reasons };
  }

  return { confidence: 'none', reasons: ['insufficient_combined_evidence'] };
}

export function buildConsumerDuplicateGroups(events: EventSummary[]): ConsumerDuplicateGroup[] {
  const groups: ConsumerDuplicateGroup[] = [];
  const consumed = new Set<string>();

  for (let i = 0; i < events.length; i += 1) {
    for (let j = i + 1; j < events.length; j += 1) {
      const left = events[i]!;
      const right = events[j]!;
      const assessment = assessConsumerDuplicatePair(left, right);
      if (assessment.confidence === 'none') {
        continue;
      }
      const winner = pickCanonicalWinner(left, right);
      const loser = winner.id === left.id ? right : left;
      const key = [winner.id, loser.id].sort().join(':');
      if (consumed.has(key)) {
        continue;
      }
      consumed.add(key);
      groups.push({
        confidence: assessment.confidence,
        eventIds: [left.id, right.id],
        titles: [left.title, right.title],
        winnerId: winner.id,
      });
    }
  }

  return groups;
}

export function buildConsumerCanonicalAliases(groups: ConsumerDuplicateGroup[]): Map<string, string> {
  const aliases = new Map<string, string>();
  for (const group of groups) {
    if (group.confidence !== 'high') {
      continue;
    }
    for (const eventId of group.eventIds) {
      if (eventId !== group.winnerId) {
        aliases.set(eventId, group.winnerId);
      }
    }
  }
  return aliases;
}

export function getDiscoverablePublishedEvents(
  events: EventSummary[],
  options: ConsumerDiscoveryFeedOptions = {},
): ConsumerDiscoveryFeedResult {
  const referenceInstant = options.referenceInstant ?? new Date();
  const currentEvents = events.filter((event) => {
    const lifecycle = classifyConsumerEventLifecycle({
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status: 'published',
      referenceInstant,
    });
    return isDiscoverableConsumerLifecycle(lifecycle);
  });

  const duplicateGroups = buildConsumerDuplicateGroups(currentEvents);
  const canonicalAliases = buildConsumerCanonicalAliases(duplicateGroups);
  const suppressed = new Set(canonicalAliases.keys());
  const deduped = currentEvents.filter((event) => !suppressed.has(event.id));

  return {
    events: deduped,
    canonicalAliases,
    duplicateGroups,
  };
}
