import * as cheerio from 'cheerio';

import { fingerprintHtmlPage } from '../fingerprint';
import type { ConnectorErrorCounters, OfficialEventEvidence } from '../types';
import {
  getSourceTimezone,
  isEndAfterStart,
  isValidIsoDateTime,
  parseBootshausDisplayDateTime,
} from './berlin-datetime';
import {
  BOOTSHAUS_CONNECTOR_ID,
  BOOTSHAUS_LIST_URL,
} from './constants';
import {
  cleanDescriptionParagraphs,
  extractDescriptionParagraphsFromHtml,
  splitDescriptionAndLineupBlocks,
} from './parse-description';
import { parseBootshausExplicitGenres } from './parse-genres';
import { parseBootshausLineupParagraphs } from './parse-lineup';
import { parseBootshausVenueBlock } from './parse-venue';
import { buildBootshausDetailUrl, canonicalizeBootshausUrl } from './url-policy';

function readDetailFieldHtml($: cheerio.CheerioAPI, label: string): string {
  let value = '';
  $('.event-details-container > div').each((_index, element) => {
    const heading = $(element).find('h4').first().text().replace(/\s+/g, ' ').trim();
    if (heading.toLowerCase() === label.toLowerCase()) {
      const clone = $(element).clone();
      clone.find('h4').remove();
      value = clone.html() ?? '';
    }
  });
  return value;
}

function readDetailFieldText($: cheerio.CheerioAPI, label: string): string {
  return readDetailFieldHtml($, label)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTicketUrl($: cheerio.CheerioAPI): string | undefined {
  const ticketAnchor = $('a.button.secondary.fluid[href*="ticket"]').first();
  const href = ticketAnchor.attr('href')?.trim();
  if (!href || !/^https:\/\//i.test(href)) {
    return undefined;
  }
  return href;
}

function extractOfficialImageUrl($: cheerio.CheerioAPI): string | undefined {
  const ogImage = $('meta[property="og:image"]').attr('content')?.trim();
  if (ogImage && /\/events\//i.test(ogImage) && /^https:\/\//i.test(ogImage)) {
    return ogImage;
  }

  const inlineImage = $('.upcoming-image.detail img').attr('src')?.trim();
  if (inlineImage && /\/events\//i.test(inlineImage) && /^https:\/\//i.test(inlineImage)) {
    return inlineImage;
  }

  return undefined;
}

function extractTitle($: cheerio.CheerioAPI): string {
  const title = $('.upcoming-title').first().text().replace(/\s+/g, ' ').trim();
  if (title) {
    return title;
  }

  const ogTitle = $('meta[property="og:title"]').attr('content') ?? '';
  return ogTitle.replace(/\s*\|\s*Bootshaus Club\s*$/i, '').trim();
}

export function parseBootshausDetailPage(
  html: string,
  officialUrl: string,
  fetchedAt: string,
  counters: ConnectorErrorCounters,
): OfficialEventEvidence {
  const canonicalUrl = canonicalizeBootshausUrl(officialUrl);
  const slug = canonicalUrl ? new URL(canonicalUrl).pathname.split('/').filter(Boolean)[1] : null;
  const sourceEventKey = slug ?? officialUrl;
  const $ = cheerio.load(html);

  const startsAtRaw = readDetailFieldText($, 'Begin');
  const endsAtRaw = readDetailFieldText($, 'End');
  const locationRaw = readDetailFieldHtml($, 'Location');

  const startsAt = parseBootshausDisplayDateTime(startsAtRaw) ?? '';
  const endsAt = endsAtRaw ? parseBootshausDisplayDateTime(endsAtRaw) ?? undefined : undefined;

  if (!startsAt || !isValidIsoDateTime(startsAt)) {
    counters.invalidDates += 1;
  }
  if (endsAt && (!isValidIsoDateTime(endsAt) || !isEndAfterStart(startsAt, endsAt))) {
    counters.endBeforeStart += 1;
  }

  const descriptionHtml = $('.event-description-content').html() ?? '';
  const paragraphs = extractDescriptionParagraphsFromHtml(descriptionHtml);
  const { descriptionParagraphs, lineupParagraphs, lineupNotAnnounced } =
    splitDescriptionAndLineupBlocks(paragraphs);
  const descriptionRaw = cleanDescriptionParagraphs([
    ...descriptionParagraphs,
    ...lineupParagraphs,
  ]);
  const descriptionClean = cleanDescriptionParagraphs(descriptionParagraphs);

  if (descriptionClean !== descriptionRaw && descriptionClean.length < descriptionRaw.length) {
    // tracked only when boilerplate survived into clean text
  }

  const lineupResult = parseBootshausLineupParagraphs(lineupParagraphs);
  const explicitGenreLabels = parseBootshausExplicitGenres($('.genres-container').html() ?? '');
  const enrichmentGaps: string[] = [];

  if (lineupNotAnnounced && lineupResult.lineupCandidates.length === 0) {
    enrichmentGaps.push('lineup_not_announced');
  } else if (lineupResult.lineupCandidates.length === 0 && lineupParagraphs.length === 0) {
    enrichmentGaps.push('lineup_not_announced');
  }

  if (explicitGenreLabels.length === 0) {
    enrichmentGaps.push('genres_missing');
  }

  const pageFingerprint = fingerprintHtmlPage(html);
  if (!pageFingerprint) {
    counters.missingFingerprints += 1;
  }

  const evidence: OfficialEventEvidence = {
    connectorId: BOOTSHAUS_CONNECTOR_ID,
    sourceEventKey,
    listUrl: BOOTSHAUS_LIST_URL,
    officialUrl: canonicalUrl ?? buildBootshausDetailUrl(sourceEventKey) ?? officialUrl,
    fetchedAt,
    pageFingerprint,
    title: extractTitle($),
    startsAt,
    endsAt,
    sourceTimezone: getSourceTimezone(),
    venue: locationRaw ? parseBootshausVenueBlock(locationRaw) : undefined,
    organizerLabel: $('.upcoming-subtitle').first().text().replace(/\s+/g, ' ').trim() || undefined,
    descriptionRaw: descriptionRaw || undefined,
    descriptionClean: descriptionClean || undefined,
    officialImageUrl: extractOfficialImageUrl($),
    linkedTicketUrl: extractTicketUrl($),
    lineupCandidates: lineupResult.lineupCandidates,
    explicitGenreLabels,
    enrichmentGaps,
    rejectedCandidates: lineupResult.rejectedCandidates,
  };

  if (!evidence.officialUrl) {
    counters.missingOfficialUrls += 1;
  }

  return evidence;
}
