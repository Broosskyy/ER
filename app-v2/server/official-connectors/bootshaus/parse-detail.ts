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
  domBlocksToParsedActs,
  extractArtistsContainerBlock,
  extractLineupContainerBlock,
  extractTimetableBlock,
} from './parse-dom-sections';
import {
  cleanDescriptionParagraphs,
  extractDescriptionParagraphsFromHtml,
  stripTrailingFooterParagraphs,
  truncateDescriptionBeforeStructuredFloorList,
} from './parse-description';
import { parseBootshausGenreEvidence, parseDescriptionExplicitGenres } from './parse-genres';
import { normalizeOfficialGenreLabels } from '../shared/normalize-genre';
import {
  blocksToParsedActs,
  mergeOfficialLineupEvidence,
  parseExplicitLineupSentences,
  splitDescriptionAndStructuredLineup,
} from './parse-lineup';
import { parseBootshausVenueBlock } from './parse-venue';
import { buildBootshausDetailUrl, canonicalizeBootshausUrl } from './url-policy';
import {
  discoverTicketLinksFromHtml,
  selectPrimaryTicketLink,
} from '../ticket-evidence/discover-ticket-links';

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

function extractTicketUrl($: cheerio.CheerioAPI, pageUrl: string): string | undefined {
  const html = $.root().html() ?? '';
  const links = discoverTicketLinksFromHtml(html, pageUrl, new Date().toISOString());
  const primary = selectPrimaryTicketLink(links);
  return primary?.rawUrl;
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
  const structuredSplit = splitDescriptionAndStructuredLineup(paragraphs);
  const sentenceActs = parseExplicitLineupSentences(structuredSplit.descriptionParagraphs);
  const domBlocks = [
    extractLineupContainerBlock($),
    extractArtistsContainerBlock($),
    extractTimetableBlock($),
  ].filter((block): block is NonNullable<typeof block> => Boolean(block));

  const lineupActs = [
    ...blocksToParsedActs(structuredSplit.lineupBlocks),
    ...domBlocksToParsedActs(domBlocks),
    ...sentenceActs,
  ];
  const lineupResult = mergeOfficialLineupEvidence(lineupActs);

  const editorialDescriptionParagraphs = truncateDescriptionBeforeStructuredFloorList(
    structuredSplit.descriptionParagraphs,
  );
  const descriptionParagraphsForClean = stripTrailingFooterParagraphs(editorialDescriptionParagraphs);
  const descriptionRaw =
    cleanDescriptionParagraphs([
      ...stripTrailingFooterParagraphs(editorialDescriptionParagraphs),
      ...structuredSplit.lineupBlocks.flatMap((block) => block.rawLines),
    ]) || undefined;
  const descriptionClean = cleanDescriptionParagraphs(descriptionParagraphsForClean) || undefined;

  const genreEvidence = parseBootshausGenreEvidence($('.genres-container').html() ?? '');
  const descriptionGenreLabels = parseDescriptionExplicitGenres(descriptionRaw);
  const resolvedGenreEvidence =
    descriptionGenreLabels.length > 0
      ? {
          explicitGenreLabels: descriptionGenreLabels,
          normalizedGenres: normalizeOfficialGenreLabels(descriptionGenreLabels).normalized,
          unmappedGenreLabels: normalizeOfficialGenreLabels(descriptionGenreLabels).unmapped,
        }
      : genreEvidence;
  const enrichmentGaps: string[] = [];

  if (structuredSplit.lineupNotAnnounced && lineupResult.lineupCandidates.length === 0) {
    enrichmentGaps.push('lineup_not_announced');
  } else if (lineupResult.lineupCandidates.length === 0) {
    const hasLineupSignals =
      structuredSplit.lineupBlocks.length > 0 ||
      domBlocks.length > 0 ||
      /line\s*-?\s*up|artists/i.test(descriptionHtml);
    if (hasLineupSignals) {
      enrichmentGaps.push('lineup_media_required');
    } else {
      enrichmentGaps.push('lineup_not_announced');
    }
  }

  if (resolvedGenreEvidence.explicitGenreLabels.length === 0) {
    if ($('.genres-container').length > 0 && $('.genres-container').hasClass('element-hidden')) {
      enrichmentGaps.push('genres_media_required');
    } else {
      enrichmentGaps.push('genres_missing');
    }
  }

  for (const unmapped of resolvedGenreEvidence.unmappedGenreLabels) {
    enrichmentGaps.push(`genre_label_unmapped:${unmapped.rawLabel}`);
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
    linkedTicketUrl: extractTicketUrl($, canonicalUrl ?? officialUrl),
    lineupCandidates: lineupResult.lineupCandidates,
    explicitGenreLabels: resolvedGenreEvidence.explicitGenreLabels,
    enrichmentGaps,
    rejectedCandidates: lineupResult.rejectedCandidates,
    evidenceAudit: {
      lineupBlocks: structuredSplit.lineupBlocks.map((block) => ({
        blockType: block.blockType,
        headerText: block.headerText,
        rawLines: block.rawLines,
      })),
      normalizedGenres: resolvedGenreEvidence.normalizedGenres,
      unmappedGenreLabels: resolvedGenreEvidence.unmappedGenreLabels.map((entry) => entry.rawLabel),
    },
  };

  if (!evidence.officialUrl) {
    counters.missingOfficialUrls += 1;
  }

  return evidence;
}
