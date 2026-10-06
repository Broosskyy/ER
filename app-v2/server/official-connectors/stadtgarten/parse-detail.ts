import * as cheerio from 'cheerio';

import { fingerprintHtmlPage } from '../fingerprint';
import { normalizeOfficialGenreLabels } from '../shared/normalize-genre';
import {
  discoverTicketLinksFromHtml,
  selectPrimaryTicketLink,
} from '../ticket-evidence/discover-ticket-links';
import type { ConnectorErrorCounters, OfficialEventEvidence } from '../types';
import {
  STADTGARTEN_CONNECTOR_ID,
  STADTGARTEN_LIST_URL,
} from './constants';
import {
  applyTimeToIsoDate,
  extractStadtgartenBeginnTime,
  getStadtgartenSourceTimezone,
  isValidIsoDateTime,
  parseStadtgartenDisplayDate,
} from './parse-datetime';
import type { StadtgartenListEntry } from './parse-list';
import { assessStadtgartenScope, splitPublishedGenreLabels } from './parse-scope';
import { parseStadtgartenVenueFromRoom } from './parse-venue';
import { canonicalizeStadtgartenUrl, extractStadtgartenEventId } from './url-policy';

function readAsideMonoBlocks($: cheerio.CheerioAPI): string[] {
  const blocks: string[] = [];
  $('.asidetext p.mono span.block').each((_index, element) => {
    const value = $(element).text().replace(/\s+/g, ' ').trim();
    if (value) {
      blocks.push(value);
    }
  });
  return blocks;
}

function extractRoomLabel(monoBlocks: readonly string[]): string | undefined {
  const room = monoBlocks.find(
    (block) => /^(GREEN ROOM|JAKI|STADTGARTEN|KOMBITICKET)$/i.test(block),
  );
  return room ?? undefined;
}

function extractDescription($: cheerio.CheerioAPI): string {
  const paragraphs: string[] = [];
  $('.maintext p').each((_index, element) => {
    const text = $(element).text().replace(/\s+/g, ' ').trim();
    if (text) {
      paragraphs.push(text);
    }
  });
  return paragraphs.join('\n\n');
}

function extractImageUrl($: cheerio.CheerioAPI): string | undefined {
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
  if (ogImage && /^https:\/\//i.test(ogImage)) {
    return ogImage;
  }

  const noscriptImage = $('.col-md-4 noscript img').first().attr('src')?.trim();
  if (noscriptImage && /^https:\/\//i.test(noscriptImage)) {
    return noscriptImage;
  }

  return undefined;
}

function extractCategories($: cheerio.CheerioAPI): string[] {
  const categories: string[] = [];
  $('.asidetext span.category').each((_index, element) => {
    const value = $(element).text().replace(/\s+/g, ' ').trim();
    if (value) {
      categories.push(value);
    }
  });
  return categories;
}

function buildEventFingerprint(evidence: {
  title: string;
  startsAt: string;
  descriptionClean?: string;
  officialImageUrl?: string;
  linkedTicketUrl?: string;
  explicitGenreLabels: string[];
  venueName?: string;
}): string {
  return fingerprintHtmlPage(
    JSON.stringify({
      title: evidence.title,
      startsAt: evidence.startsAt,
      descriptionClean: evidence.descriptionClean ?? '',
      officialImageUrl: evidence.officialImageUrl ?? '',
      linkedTicketUrl: evidence.linkedTicketUrl ?? '',
      explicitGenreLabels: evidence.explicitGenreLabels,
      venueName: evidence.venueName ?? '',
    }),
  );
}

export function parseStadtgartenDetailPage(
  html: string,
  finalUrl: string,
  fetchedAt: string,
  counters: ConnectorErrorCounters,
  listEntry?: StadtgartenListEntry,
): OfficialEventEvidence {
  const canonicalUrl = canonicalizeStadtgartenUrl(finalUrl);
  const officialUrl = canonicalUrl ?? finalUrl;
  const sourceEventKey = extractStadtgartenEventId(officialUrl) ?? listEntry?.sourceEventKey ?? '';
  if (!sourceEventKey) {
    counters.missingOfficialUrls += 1;
  }

  const $ = cheerio.load(html);
  const title =
    $('.maintext h4').first().text().replace(/\s+/g, ' ').trim() ||
    listEntry?.title ||
    $('meta[property="og:title"]').attr('content')?.split('|')[0]?.trim() ||
    '';

  const displayDate = $('.asidetext .mono.ttu').first().text().replace(/\s+/g, ' ').trim();
  const isoDate = parseStadtgartenDisplayDate(displayDate);
  const monoBlocks = readAsideMonoBlocks($);
  const beginnTime = extractStadtgartenBeginnTime(monoBlocks.join(' '));
  let startsAt = '';
  if (isoDate && beginnTime) {
    startsAt = applyTimeToIsoDate(isoDate, beginnTime.hour, beginnTime.minute) ?? '';
  }
  if (!startsAt || !isValidIsoDateTime(startsAt)) {
    counters.invalidDates += 1;
  }

  const detailGenreLabel = $('.asidetext p.bold').first().text().replace(/\s+/g, ' ').trim();
  const genreLabelsFromDetail = splitPublishedGenreLabels(detailGenreLabel);
  const explicitGenreLabels =
    genreLabelsFromDetail.length > 0
      ? genreLabelsFromDetail
      : listEntry?.genreLabels ?? splitPublishedGenreLabels(listEntry?.genreLabel ?? '');

  const categories =
    extractCategories($).length > 0 ? extractCategories($) : listEntry?.categories ?? [];

  const descriptionClean = extractDescription($);
  const descriptionRaw = descriptionClean || undefined;
  const officialImageUrl = extractImageUrl($);
  const roomLabel = extractRoomLabel(monoBlocks);
  const venue = parseStadtgartenVenueFromRoom(roomLabel);

  const ticketLinks = discoverTicketLinksFromHtml(html, officialUrl, fetchedAt);
  const primaryTicket = selectPrimaryTicketLink(ticketLinks);
  const linkedTicketUrl = primaryTicket?.rawUrl;

  const enrichmentGaps: string[] = ['lineup_not_announced'];
  if (!descriptionClean) {
    enrichmentGaps.push('description_missing');
  }
  if (explicitGenreLabels.length === 0) {
    enrichmentGaps.push('genres_missing');
  }

  const scopeDecision = assessStadtgartenScope(categories, explicitGenreLabels);
  if (scopeDecision === 'outside_scope') {
    enrichmentGaps.push('outside_scope_skipped');
  }

  const normalizedGenreResult = normalizeOfficialGenreLabels(explicitGenreLabels);

  const pageFingerprint = buildEventFingerprint({
    title,
    startsAt,
    descriptionClean,
    officialImageUrl,
    linkedTicketUrl,
    explicitGenreLabels,
    venueName: venue.name,
  });
  if (!pageFingerprint) {
    counters.missingFingerprints += 1;
  }

  return {
    connectorId: STADTGARTEN_CONNECTOR_ID,
    sourceEventKey,
    listUrl: STADTGARTEN_LIST_URL,
    officialUrl,
    fetchedAt,
    pageFingerprint,
    title,
    startsAt,
    sourceTimezone: getStadtgartenSourceTimezone(),
    venue,
    organizerLabel: 'Stadtgarten Köln',
    descriptionRaw,
    descriptionClean,
    officialImageUrl,
    linkedTicketUrl,
    lineupCandidates: [],
    explicitGenreLabels,
    enrichmentGaps,
    rejectedCandidates: [],
    evidenceAudit: {
      lineupBlocks: [],
      normalizedGenres: [...normalizedGenreResult.normalized, ...normalizedGenreResult.unmapped],
      unmappedGenreLabels: normalizedGenreResult.unmapped.map((entry) => entry.rawLabel),
    },
  };
}
