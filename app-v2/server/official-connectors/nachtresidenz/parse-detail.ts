import { fingerprintHtmlPage } from '../fingerprint';
import type { ConnectorErrorCounters, OfficialEventEvidence } from '../types';
import {
  NACHTRESIDENZ_CONNECTOR_ID,
  NACHTRESIDENZ_LIST_URL,
} from './constants';
import {
  getNachtresidenzSourceTimezone,
  isValidIsoDateTime,
  parseNachtresidenzDatetimeAttr,
} from './parse-datetime';
import {
  extractNachtresidenzEventsFromListHtml,
  type NachtresidenzListEvent,
} from './parse-list';
import { parseNachtresidenzVenueFromTitle } from './parse-venue';
import { canonicalizeNachtresidenzUrl, extractNachtresidenzEventKey } from './url-policy';

function buildEventFingerprint(event: NachtresidenzListEvent): string {
  return fingerprintHtmlPage(
    JSON.stringify({
      title: event.title,
      datetimeAttr: event.datetimeAttr,
      descriptionText: event.descriptionText,
      imageUrl: event.imageUrl ?? '',
      externalLink: event.externalLink ?? '',
    }),
  );
}

function buildEvidenceFromListEvent(
  event: NachtresidenzListEvent,
  officialUrl: string,
  fetchedAt: string,
  counters: ConnectorErrorCounters,
): OfficialEventEvidence {
  const startsAt = parseNachtresidenzDatetimeAttr(event.datetimeAttr);
  if (!startsAt || !isValidIsoDateTime(startsAt)) {
    counters.invalidDates += 1;
  }

  const venue = parseNachtresidenzVenueFromTitle(event.title);
  const enrichmentGaps: string[] = ['lineup_not_announced', 'genres_missing'];
  if (!event.descriptionText) {
    enrichmentGaps.push('description_missing');
  }
  if (!venue.city) {
    enrichmentGaps.push('venue_city_missing');
  }

  const pageFingerprint = buildEventFingerprint(event);
  if (!pageFingerprint) {
    counters.missingFingerprints += 1;
  }

  return {
    connectorId: NACHTRESIDENZ_CONNECTOR_ID,
    sourceEventKey: event.sourceEventKey,
    listUrl: NACHTRESIDENZ_LIST_URL,
    officialUrl,
    fetchedAt,
    pageFingerprint,
    title: event.title,
    startsAt: startsAt ?? '',
    sourceTimezone: getNachtresidenzSourceTimezone(),
    venue,
    organizerLabel: 'Nachtresidenz',
    descriptionRaw: event.descriptionText || undefined,
    descriptionClean: event.descriptionText || undefined,
    officialImageUrl: event.imageUrl,
    linkedTicketUrl: event.externalLink,
    lineupCandidates: [],
    explicitGenreLabels: [],
    enrichmentGaps,
    rejectedCandidates: [],
  };
}

export function parseNachtresidenzDetailPage(
  html: string,
  officialUrl: string,
  fetchedAt: string,
  counters: ConnectorErrorCounters,
): OfficialEventEvidence {
  const canonicalUrl = canonicalizeNachtresidenzUrl(officialUrl);
  const eventKey = extractNachtresidenzEventKey(canonicalUrl ?? officialUrl);

  const events = extractNachtresidenzEventsFromListHtml(html);
  const event = events.find((entry) => entry.sourceEventKey === eventKey);
  if (!event) {
    counters.missingOfficialUrls += 1;
    const pageFingerprint = fingerprintHtmlPage(html);
    if (!pageFingerprint) {
      counters.missingFingerprints += 1;
    }
    return {
      connectorId: NACHTRESIDENZ_CONNECTOR_ID,
      sourceEventKey: eventKey ?? officialUrl,
      listUrl: NACHTRESIDENZ_LIST_URL,
      officialUrl: canonicalUrl ?? officialUrl,
      fetchedAt,
      pageFingerprint,
      title: '',
      startsAt: '',
      sourceTimezone: getNachtresidenzSourceTimezone(),
      lineupCandidates: [],
      explicitGenreLabels: [],
      enrichmentGaps: ['event_not_found_in_list'],
      rejectedCandidates: [],
    };
  }

  return buildEvidenceFromListEvent(
    event,
    canonicalUrl ?? event.officialUrl,
    fetchedAt,
    counters,
  );
}
