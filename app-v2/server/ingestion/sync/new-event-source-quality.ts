import type { EventCandidate } from '../types/event-candidate';

/**
 * Minimum event-core evidence for unattended publication from an aggregator.
 * Ticket price/status/checkout are deliberately NOT required here: the ticket
 * evidence pipeline verifies those independently before a purchase CTA appears.
 *
 * A rejected or ambiguous identity is handled by the regular planner as well.
 */
export function isRausgegangenNewEventSourceReady(
  candidate: EventCandidate,
  referenceInstant = new Date(),
): boolean {
  if (candidate.origin.kind !== 'official_connector' ||
      candidate.origin.connectorId !== 'rausgegangen-discovery') return false;
  let source: URL;
  try {
    source = new URL(candidate.origin.officialUrl);
  } catch { return false; }
  if (source.protocol !== 'https:' ||
      !['rausgegangen.de', 'www.rausgegangen.de'].includes(source.hostname) ||
      !/^\/events\/[a-z0-9-]+\/?$/i.test(source.pathname) ||
      source.username || source.password) return false;
  const timestamp = Date.parse(candidate.startsAt);
  return (
    Number.isFinite(timestamp) &&
    timestamp > referenceInstant.getTime() &&
    candidate.title.trim().length >= 5 &&
    !!candidate.venue?.name?.trim() &&
    !!candidate.venue?.city?.trim() &&
    (candidate.description?.trim().length ?? 0) >= 40
  );
}
