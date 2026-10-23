import type { EventCandidate } from '../types/event-candidate';

/**
 * Minimum event-core evidence for unattended publication from an aggregator.
 * Ticket price/status/checkout are deliberately NOT required here: the ticket
 * evidence pipeline verifies those independently before a purchase CTA appears.
 *
 * A rejected or ambiguous identity is handled by the regular planner as well.
 */
/**
 * Transport, travel and admission services are not music performances.
 * Require a matching service in the EVENT TITLE itself so ordinary event
 * descriptions mentioning shuttle options are not accidentally suppressed.
 */
export function isEventServiceInsteadOfPerformance(title: string): boolean {
  return /^(?:bus(?:fahrt|transfer)?|shuttle(?:bus|service|fahrt)?|bustransfer|transferbus|anreise|busreise|reisebus)\\b(?:\\s|\\s+(?:zu|zur|zum|nach)\\b|\\s*[:–-])/i.test(title.trim())
    || /\\b(?:busfahrt|shuttleservice|bustransfer|busreise)\\s+(?:zu|zur|zum|nach)\\b/i.test(title);
}

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
    !isEventServiceInsteadOfPerformance(candidate.title) &&
    !!candidate.venue?.name?.trim() &&
    !!candidate.venue?.city?.trim() &&
    (candidate.description?.trim().length ?? 0) >= 40
  );
}

/** Source-only fallback for an official Zakk party requires an exact dated
 * event-specific listing plus reliable core fields. Provider ticket details
 * are independently checked and never guessed. */
export function isZakkNewEventSourceReady(
  candidate: EventCandidate,
  referenceInstant = new Date(),
): boolean {
  if (candidate.origin.kind !== 'official_connector' ||
      candidate.origin.connectorId !== 'zakk-official') return false;
  let url: URL;
  try { url = new URL(candidate.origin.officialUrl); }
  catch { return false; }
  const eventId = url.searchParams.get('event');
  if (url.protocol !== 'https:' ||
      !['zakk.de', 'www.zakk.de'].includes(url.hostname) ||
      !/^\/event-detail\/?$/i.test(url.pathname) ||
      !eventId || !/^\d+$/.test(eventId) ||
      url.username || url.password) return false;
  const start = Date.parse(candidate.startsAt);
  return (
    Number.isFinite(start) && start > referenceInstant.getTime() &&
    candidate.title.trim().length >= 5 &&
    !!candidate.venue?.name?.trim() && !!candidate.venue?.city?.trim() &&
    (candidate.description?.trim().length ?? 0) >= 40
  );
}

/** Fresh electronic-only Stadtgarten event source. An event-specific page,
 * confirmed time, location and description are mandatory for NEW imports. */
export function isStadtgartenNewEventSourceReady(
  candidate: EventCandidate,
  referenceInstant = new Date(),
): boolean {
  if (candidate.origin.kind !== 'official_connector' ||
      candidate.origin.connectorId !== 'stadtgarten-official') return false;
  let url: URL;
  try { url = new URL(candidate.origin.officialUrl); }
  catch { return false; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.stadtgarten.de' ||
      !/^\/programm\/[a-z0-9-]+-\d+\/?$/i.test(url.pathname) ||
      url.username || url.password) return false;
  const start = Date.parse(candidate.startsAt);
  return Number.isFinite(start) && start > referenceInstant.getTime() &&
    candidate.title.trim().length >= 5 &&
    !!candidate.venue?.name?.trim() && !!candidate.venue?.city?.trim() &&
    (candidate.description?.trim().length ?? 0) >= 40;
}
