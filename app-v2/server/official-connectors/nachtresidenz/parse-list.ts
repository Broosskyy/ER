import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import {
  buildNachtresidenzEventUrl,
  canonicalizeNachtresidenzUrl,
  extractNachtresidenzEventKey,
  normalizeDatetimeForPath,
  slugifyNachtresidenzTitle,
} from './url-policy';

export interface NachtresidenzListEvent {
  sourceEventKey: string;
  officialUrl: string;
  title: string;
  datetimeAttr: string;
  descriptionText: string;
  imageUrl?: string;
  externalLink?: string;
}

function readExternalLink(
  $: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<Element>,
): string | undefined {
  const overlayLink = $card.find('a.b-box__link').attr('href')?.trim();
  if (overlayLink && overlayLink.length > 0 && overlayLink !== '#') {
    return overlayLink;
  }

  const mehrLink = $card
    .find('a.btn-pointer__txt')
    .filter((_index, element) => $(element).text().trim().toLowerCase() === 'mehr')
    .first()
    .closest('a')
    .attr('href')
    ?.trim();

  if (mehrLink && mehrLink.length > 0 && mehrLink !== '#') {
    return mehrLink;
  }

  return undefined;
}

export function extractNachtresidenzEventsFromListHtml(html: string): NachtresidenzListEvent[] {
  const $ = cheerio.load(html);
  const events: NachtresidenzListEvent[] = [];
  const seenKeys = new Set<string>();

  $('.b-tabs__pane-item .c-box').each((_index, element) => {
    const $card = $(element);
    const title = $card.find('.c-box__ttl-s3').first().text().replace(/\s+/g, ' ').trim();
    const datetimeAttr = $card.find('time[datetime]').first().attr('datetime')?.trim() ?? '';
    if (!title || !datetimeAttr) {
      return;
    }

    const officialUrl = buildNachtresidenzEventUrl(datetimeAttr, title);
    if (!officialUrl) {
      return;
    }

    const sourceEventKey = extractNachtresidenzEventKey(officialUrl);
    if (!sourceEventKey || seenKeys.has(sourceEventKey)) {
      return;
    }
    seenKeys.add(sourceEventKey);

    const descriptionText = $card.find('.c-box__txt').first().text().replace(/\s+/g, ' ').trim();
    const bgImage = $card.find('[data-bgimage]').first().attr('data-bgimage')?.trim();
    const imageUrl =
      bgImage && /^https:\/\//i.test(bgImage) ? bgImage : undefined;

    events.push({
      sourceEventKey,
      officialUrl,
      title,
      datetimeAttr,
      descriptionText,
      imageUrl,
      externalLink: readExternalLink($, $card),
    });
  });

  return events.sort((left, right) => left.officialUrl.localeCompare(right.officialUrl));
}

export function extractNachtresidenzDetailUrlsFromListHtml(html: string): string[] {
  return extractNachtresidenzEventsFromListHtml(html).map((event) => event.officialUrl);
}

export function dedupeNachtresidenzDetailUrls(urls: readonly string[]): {
  uniqueUrls: string[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  let duplicateCount = 0;
  const uniqueUrls: string[] = [];

  for (const url of urls) {
    const canonical = canonicalizeNachtresidenzUrl(url);
    if (!canonical) {
      continue;
    }

    if (seen.has(canonical)) {
      duplicateCount += 1;
      continue;
    }

    seen.add(canonical);
    uniqueUrls.push(canonical);
  }

  return { uniqueUrls, duplicateCount };
}

export function buildNachtresidenzSourceEventKey(datetimeAttr: string, title: string): string | null {
  const slug = slugifyNachtresidenzTitle(title);
  if (!slug) {
    return null;
  }
  const normalizedDatetime = normalizeDatetimeForPath(datetimeAttr);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(normalizedDatetime)) {
    return null;
  }
  return `${normalizedDatetime}/${slug}`;
}
