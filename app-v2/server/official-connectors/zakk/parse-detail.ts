import * as cheerio from 'cheerio';

import { fingerprintHtmlPage } from '../fingerprint';
import {
  discoverTicketLinksFromHtml,
  selectPrimaryTicketLink,
} from '../ticket-evidence/discover-ticket-links';
import type { ConnectorErrorCounters, OfficialEventEvidence } from '../types';
import { ZAKK_CONNECTOR_ID, ZAKK_LIST_URL } from './constants';
import {
  applyTimeToIsoDate,
  extractZakkStartTime,
  getZakkSourceTimezone,
  isValidIsoDateTime,
  parseZakkGermanDate,
  parseZakkJsonLdStartDate,
} from './parse-datetime';
import type { ZakkListEntry } from './parse-list';
import { parseZakkVenueFromJsonLd, parseZakkVenueFromRoom } from './parse-venue';
import { buildZakkDetailUrl, canonicalizeZakkUrl, extractZakkEventId } from './url-policy';

interface ZakkJsonLdEvent {
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  image?: string | string[];
  location?: {
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      postalCode?: string;
      addressCountry?: string;
    };
  };
}

function parseJsonLdEvent(html: string): ZakkJsonLdEvent | null {
  const match = html.match(
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) {
    return null;
  }
  try {
    const payload = JSON.parse(match[1]) as ZakkJsonLdEvent & { '@type'?: string };
    if (payload['@type'] !== 'Event' && !payload.name) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function normalizeZakkImageUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl?.trim()) {
    return undefined;
  }
  try {
    const parsed = new URL(rawUrl.trim(), 'https://www.zakk.de/');
    if (parsed.protocol !== 'https:') {
      return undefined;
    }
    if (parsed.hostname !== 'zakk.de' && parsed.hostname !== 'www.zakk.de') {
      return undefined;
    }
    parsed.hostname = 'zakk.de';
    parsed.pathname = parsed.pathname.replace(/\/{2,}/g, '/');
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function resolveImageUrl(jsonLd: ZakkJsonLdEvent | null, $: cheerio.CheerioAPI): string | undefined {
  const jsonImage = jsonLd?.image;
  if (typeof jsonImage === 'string') {
    const normalized = normalizeZakkImageUrl(jsonImage);
    if (normalized) {
      return normalized;
    }
  }
  if (Array.isArray(jsonImage)) {
    for (const entry of jsonImage) {
      const normalized = normalizeZakkImageUrl(entry);
      if (normalized) {
        return normalized;
      }
    }
  }

  const inline = $('.event-image-box img.event-list-image').attr('src')?.trim();
  return normalizeZakkImageUrl(inline);
}

function extractLongDescription($: cheerio.CheerioAPI): string {
  const paragraphs: string[] = [];
  $('.event-additional .box p').each((_index, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (text) {
      paragraphs.push(text);
    }
  });
  return paragraphs.join('\n\n');
}

function buildEventFingerprint(evidence: {
  sourceEventKey: string;
  title: string;
  startsAt: string;
  descriptionClean?: string;
  officialImageUrl?: string;
  linkedTicketUrl?: string;
  venueName?: string;
}): string {
  return fingerprintHtmlPage(
    JSON.stringify({
      sourceEventKey: evidence.sourceEventKey,
      title: evidence.title,
      startsAt: evidence.startsAt,
      descriptionClean: evidence.descriptionClean ?? '',
      officialImageUrl: evidence.officialImageUrl ?? '',
      linkedTicketUrl: evidence.linkedTicketUrl ?? '',
      venueName: evidence.venueName ?? '',
    }),
  );
}

function resolveStartsAt(
  jsonLd: ZakkJsonLdEvent | null,
  displayDate: string,
  listDateLabel: string,
  timeLabel: string,
): string {
  let startsAt = '';
  if (jsonLd?.startDate) {
    startsAt = parseZakkJsonLdStartDate(jsonLd.startDate) ?? '';
  }

  if (!startsAt) {
    const isoDate = parseZakkGermanDate(displayDate) ?? parseZakkGermanDate(listDateLabel);
    const time = extractZakkStartTime(timeLabel);
    if (isoDate && time) {
      startsAt = applyTimeToIsoDate(isoDate, time.hour, time.minute) ?? '';
    }
  }

  return startsAt;
}

export function parseZakkDetailPage(
  html: string,
  finalUrl: string,
  fetchedAt: string,
  counters: ConnectorErrorCounters,
  listEntry?: ZakkListEntry,
): OfficialEventEvidence {
  const canonicalUrl = canonicalizeZakkUrl(finalUrl);
  const sourceEventKey =
    extractZakkEventId(canonicalUrl ?? finalUrl) ?? listEntry?.sourceEventKey ?? '';
  if (!sourceEventKey) {
    counters.missingOfficialUrls += 1;
  }

  const $ = cheerio.load(html);
  const jsonLd = parseJsonLdEvent(html);

  const title =
    $('#event-header h2').first().text().replace(/\s+/g, ' ').trim() ||
    listEntry?.title ||
    jsonLd?.name?.trim() ||
    '';

  const subtitle =
    $('#event-header .event-info h3').first().text().replace(/\s+/g, ' ').trim() ||
    listEntry?.subtitle ||
    '';

  const teaser =
    $('#event-header .event-info h4').first().text().replace(/\s+/g, ' ').trim() ||
    listEntry?.teaser ||
    '';

  const displayDate = $('.event-overview .event-date').first().text().replace(/\s+/g, ' ').trim();
  const timeLabel =
    $('.event-overview .event-time').first().text().replace(/\s+/g, ' ').trim() ||
    listEntry?.timeLabel ||
    '';

  const startsAt = resolveStartsAt(
    jsonLd,
    displayDate,
    listEntry?.listDateLabel ?? '',
    timeLabel,
  );
  if (!startsAt || !isValidIsoDateTime(startsAt)) {
    counters.invalidDates += 1;
  }

  const roomLabel =
    listEntry?.roomLabel ||
    (() => {
      const timeHtml = $('.event-overview .event-time').first().html() ?? '';
      const lines = timeHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .split('\n')
        .map((line) => line.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return lines.find((line) => /^(Club|Halle)$/i.test(line)) ?? '';
    })();

  const venueFromJson = parseZakkVenueFromJsonLd(jsonLd?.location);
  const venue = roomLabel ? parseZakkVenueFromRoom(roomLabel) : venueFromJson;

  const longDescription = extractLongDescription($);
  const descriptionClean = longDescription || teaser || jsonLd?.description?.trim() || undefined;
  const descriptionRaw = descriptionClean;

  const officialUrl = canonicalUrl ?? buildZakkDetailUrl(sourceEventKey) ?? finalUrl;
  const ticketLinks = discoverTicketLinksFromHtml(html, officialUrl, fetchedAt);
  const primaryTicket = selectPrimaryTicketLink(ticketLinks);
  const linkedTicketUrl = primaryTicket?.rawUrl;
  const officialImageUrl = resolveImageUrl(jsonLd, $);

  const enrichmentGaps: string[] = ['lineup_not_announced', 'genres_missing'];
  if (!descriptionClean) {
    enrichmentGaps.push('description_missing');
  }

  const pageFingerprint = buildEventFingerprint({
    sourceEventKey,
    title,
    startsAt,
    descriptionClean,
    officialImageUrl,
    linkedTicketUrl,
    venueName: venue.name,
  });
  if (!pageFingerprint) {
    counters.missingFingerprints += 1;
  }

  return {
    connectorId: ZAKK_CONNECTOR_ID,
    sourceEventKey,
    listUrl: ZAKK_LIST_URL,
    officialUrl,
    fetchedAt,
    pageFingerprint,
    title,
    startsAt,
    sourceTimezone: getZakkSourceTimezone(),
    venue,
    organizerLabel: subtitle ? `zakk — ${subtitle}` : 'zakk',
    descriptionRaw,
    descriptionClean,
    officialImageUrl,
    linkedTicketUrl,
    lineupCandidates: [],
    explicitGenreLabels: [],
    enrichmentGaps,
    rejectedCandidates: [],
  };
}
