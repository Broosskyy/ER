import { normalizeDedupeKeyPart } from '../formatting/text';
import type { Event } from '../types/event';

export type DeduplicationVerdict = 'unique' | 'possible_duplicate' | 'confirmed_duplicate';

export interface DeduplicationMatch {
  verdict: DeduplicationVerdict;
  matchedEventId?: string;
  reason: string;
}

export interface DeduplicationDecision extends DeduplicationMatch {
  event: Event;
}

function buildTitleDateVenueKey(event: Event): string {
  return [
    normalizeDedupeKeyPart(event.title),
    event.startDateTime.slice(0, 10),
    normalizeDedupeKeyPart(event.venue),
  ].join('|');
}

function buildTitleDateCityKey(event: Event): string {
  return [
    normalizeDedupeKeyPart(event.title),
    event.startDateTime.slice(0, 10),
    normalizeDedupeKeyPart(event.city),
  ].join('|');
}

function buildSourceKey(event: Event): string {
  return `${event.source}|${event.sourceEventId}`;
}

export function classifyDuplicate(
  event: Event,
  existingEvents: Event[],
): DeduplicationMatch {
  const sourceKey = buildSourceKey(event);

  for (const existing of existingEvents) {
    if (buildSourceKey(existing) === sourceKey) {
      return {
        verdict: 'confirmed_duplicate',
        matchedEventId: existing.id,
        reason: 'Same source and sourceEventId',
      };
    }
  }

  const titleDateVenueKey = buildTitleDateVenueKey(event);

  for (const existing of existingEvents) {
    if (buildTitleDateVenueKey(existing) === titleDateVenueKey) {
      return {
        verdict: 'possible_duplicate',
        matchedEventId: existing.id,
        reason: 'Same normalized title, date, and venue',
      };
    }
  }

  const titleDateCityKey = buildTitleDateCityKey(event);

  for (const existing of existingEvents) {
    if (buildTitleDateCityKey(existing) === titleDateCityKey) {
      return {
        verdict: 'possible_duplicate',
        matchedEventId: existing.id,
        reason: 'Same normalized title, date, and city',
      };
    }
  }

  return {
    verdict: 'unique',
    reason: 'No duplicate match',
  };
}

export function deduplicateEvents(events: Event[]): DeduplicationDecision[] {
  const accepted: Event[] = [];
  const decisions: DeduplicationDecision[] = [];

  for (const event of events) {
    const match = classifyDuplicate(event, accepted);
    decisions.push({ ...match, event });
    accepted.push(event);
  }

  return decisions;
}
