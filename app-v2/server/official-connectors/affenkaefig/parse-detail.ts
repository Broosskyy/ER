import * as cheerio from 'cheerio';

import { fingerprintHtmlPage } from '../fingerprint';
import {
  mergeOfficialLineupEvidence,
  type ParsedLineupAct,
} from '../bootshaus/parse-lineup';
import {
  discoverTicketLinksFromHtml,
  selectPrimaryTicketLink,
} from '../ticket-evidence/discover-ticket-links';
import type { ConnectorErrorCounters, OfficialEventEvidence } from '../types';
import {
  AFFENKAEFIG_CONNECTOR_ID,
  AFFENKAEFIG_LIST_URL,
} from './constants';
import {
  applyTimeToIsoDate,
  extractTimeFromDescription,
  getAffenkaefigSourceTimezone,
  isEndAfterStart,
  isMidnightIso,
  isValidIsoDateTime,
  parseGermanDisplayDate,
} from './parse-datetime';
import {
  cleanAffenkaefigDescription,
  containsLineupNotAnnouncedSignal,
} from './parse-description';
import { parseAffenkaefigVenueBlock } from './parse-venue';
import { buildAffenkaefigDetailUrl, canonicalizeAffenkaefigUrl } from './url-policy';

interface JsonLdEvent {
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  image?: string | string[];
  url?: string;
  location?: {
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      postalCode?: string;
    };
  };
  organizer?: { name?: string };
}

function parseJsonLdEvent(html: string): JsonLdEvent | null {
  const match = html.match(
    /<script[^>]+type="application\/ld\+json"[^>]*class="event-cards-manager-schema"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match?.[1]) {
    return null;
  }
  try {
    const payload = JSON.parse(match[1]) as JsonLdEvent & { '@type'?: string };
    if (payload['@type'] !== 'Event' && !payload.name) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function readMetaValue($: cheerio.CheerioAPI, label: string): string {
  let value = '';
  $('.ecm-event-meta-item').each((_index, element) => {
    const itemLabel = $(element).find('.ecm-event-meta-item__label').text().trim().toLowerCase();
    if (itemLabel === label.toLowerCase()) {
      value = $(element).find('.ecm-event-meta-item__value').text().replace(/\s+/g, ' ').trim();
    }
  });
  return value;
}

function extractLineupActs($: cheerio.CheerioAPI): ParsedLineupAct[] {
  const acts: ParsedLineupAct[] = [];
  $('.ecm-event-lineup__name').each((index, element) => {
    const displayName = $(element).text().replace(/\s+/g, ' ').trim();
    if (!displayName) {
      return;
    }
    acts.push({
      displayName,
      rawText: displayName,
      evidenceRole: index === 0 ? 'headliner' : 'artist',
      blockType: 'artists_section',
      blockIndex: 0,
      lineIndex: index,
      confidence: 'high',
    });
  });
  return acts;
}

function resolveImageUrl(jsonLd: JsonLdEvent | null, $: cheerio.CheerioAPI): string | undefined {
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
  if (ogImage && /^https:\/\//i.test(ogImage)) {
    return ogImage;
  }
  const jsonImage = jsonLd?.image;
  if (typeof jsonImage === 'string' && /^https:\/\//i.test(jsonImage)) {
    return jsonImage;
  }
  if (Array.isArray(jsonImage)) {
    const first = jsonImage.find((entry) => /^https:\/\//i.test(entry));
    if (first) {
      return first;
    }
  }
  const flyer = $('.ecm-event-single__flyer').attr('src')?.trim();
  return flyer && /^https:\/\//i.test(flyer) ? flyer : undefined;
}

function resolveStartsAt(
  jsonLd: JsonLdEvent | null,
  displayDate: string,
  descriptionText: string,
): string {
  let startsAt = jsonLd?.startDate?.trim() || '';
  if (!startsAt && displayDate) {
    startsAt = parseGermanDisplayDate(displayDate) ?? '';
  }

  if (startsAt && isMidnightIso(startsAt)) {
    const time = extractTimeFromDescription(descriptionText);
    if (time) {
      const withTime = applyTimeToIsoDate(startsAt, time.hour, time.minute);
      if (withTime) {
        startsAt = withTime;
      }
    }
  }

  return startsAt;
}

export function parseAffenkaefigDetailPage(
  html: string,
  officialUrl: string,
  fetchedAt: string,
  counters: ConnectorErrorCounters,
): OfficialEventEvidence {
  const canonicalUrl = canonicalizeAffenkaefigUrl(officialUrl);
  const slug = canonicalUrl ? new URL(canonicalUrl).pathname.split('/').filter(Boolean)[1] : null;
  const sourceEventKey = slug ?? officialUrl;
  const $ = cheerio.load(html);
  const jsonLd = parseJsonLdEvent(html);

  const title =
    $('.ecm-event-single__title').first().text().replace(/\s+/g, ' ').trim() ||
    $('h1.entry-title').first().text().replace(/\s+/g, ' ').trim() ||
    jsonLd?.name?.trim() ||
    '';

  const displayDate = readMetaValue($, 'Datum');
  const locationLabel = readMetaValue($, 'Location');
  const addressLine = readMetaValue($, 'Adresse');
  const descriptionHtml = $('.ecm-event-single__content').html() ?? '';
  const descriptionClean =
    cleanAffenkaefigDescription(descriptionHtml) ||
    jsonLd?.description?.trim() ||
    undefined;
  const descriptionRaw = descriptionClean;

  const startsAt = resolveStartsAt(jsonLd, displayDate, descriptionClean ?? '');
  const endsAt = jsonLd?.endDate?.trim() || undefined;

  if (!startsAt || !isValidIsoDateTime(startsAt)) {
    counters.invalidDates += 1;
  }
  if (endsAt && (!isValidIsoDateTime(endsAt) || !isEndAfterStart(startsAt, endsAt))) {
    counters.endBeforeStart += 1;
  }

  const lineupActs = extractLineupActs($);
  const lineupResult = mergeOfficialLineupEvidence(lineupActs);
  const lineupNotAnnouncedSignal = containsLineupNotAnnouncedSignal(descriptionClean ?? '');
  const hasLineupSection = $('.ecm-event-lineup').length > 0;

  const enrichmentGaps: string[] = [];
  if (lineupResult.lineupCandidates.length === 0) {
    if (lineupNotAnnouncedSignal || (hasLineupSection && lineupActs.length === 0)) {
      enrichmentGaps.push('lineup_not_announced');
    } else if (!hasLineupSection) {
      enrichmentGaps.push('lineup_not_announced');
    } else {
      enrichmentGaps.push('lineup_media_required');
    }
  }

  enrichmentGaps.push('genres_missing');

  const pageFingerprint = fingerprintHtmlPage(html);
  if (!pageFingerprint) {
    counters.missingFingerprints += 1;
  }

  const ticketLinks = discoverTicketLinksFromHtml(html, canonicalUrl ?? officialUrl, fetchedAt);
  const primaryTicket = selectPrimaryTicketLink(ticketLinks);

  const evidence: OfficialEventEvidence = {
    connectorId: AFFENKAEFIG_CONNECTOR_ID,
    sourceEventKey,
    listUrl: AFFENKAEFIG_LIST_URL,
    officialUrl: canonicalUrl ?? buildAffenkaefigDetailUrl(sourceEventKey) ?? officialUrl,
    fetchedAt,
    pageFingerprint,
    title,
    startsAt,
    endsAt,
    sourceTimezone: getAffenkaefigSourceTimezone(),
    venue: locationLabel
      ? parseAffenkaefigVenueBlock(locationLabel, addressLine || jsonLd?.location?.address?.streetAddress)
      : jsonLd?.location?.name
        ? parseAffenkaefigVenueBlock(
            jsonLd.location.name,
            jsonLd.location.address?.streetAddress,
          )
        : undefined,
    organizerLabel: jsonLd?.organizer?.name?.trim() || 'Affenkäfig',
    descriptionRaw,
    descriptionClean,
    officialImageUrl: resolveImageUrl(jsonLd, $),
    linkedTicketUrl: primaryTicket?.rawUrl,
    lineupCandidates: lineupResult.lineupCandidates,
    explicitGenreLabels: [],
    enrichmentGaps,
    rejectedCandidates: lineupResult.rejectedCandidates,
    evidenceAudit: {
      lineupBlocks: [],
      normalizedGenres: [],
      unmappedGenreLabels: [],
    },
  };

  if (!evidence.officialUrl) {
    counters.missingOfficialUrls += 1;
  }

  return evidence;
}
