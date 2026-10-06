import * as cheerio from 'cheerio';

import {
  buildZakkDetailUrl,
  canonicalizeZakkUrl,
  extractZakkEventId,
} from './url-policy';

export interface ZakkListEntry {
  detailUrl: string;
  sourceEventKey: string;
  title: string;
  subtitle: string;
  teaser: string;
  listDateLabel: string;
  category: string;
  timeLabel: string;
  roomLabel: string;
}

function readRoomLabel(timeHtml: string): string {
  const lines = timeHtml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const room = lines.find((line) => /^(Club|Halle)$/i.test(line));
  return room ?? '';
}

export function extractZakkListEntriesFromHtml(html: string): ZakkListEntry[] {
  const $ = cheerio.load(html);
  const entries: ZakkListEntry[] = [];

  $('li.single-ticket.cf').each((_index, element) => {
    const $item = $(element);
    if ($item.hasClass('monthly-list')) {
      return;
    }

    const href = $item.find('a[href*="/event-detail?event="]').first().attr('href');
    if (!href) {
      return;
    }

    const detailUrl = canonicalizeZakkUrl(href);
    if (!detailUrl) {
      return;
    }

    const sourceEventKey = extractZakkEventId(detailUrl);
    if (!sourceEventKey) {
      return;
    }

    const title = $item.find('.ticket-info h2 a').first().text().replace(/\s+/g, ' ').trim();
    const subtitle = $item.find('.ticket-info h3').first().text().replace(/\s+/g, ' ').trim();
    const teaser = $item.find('.ticket-info p').first().text().replace(/\s+/g, ' ').trim();
    const listDateLabel = String($item.attr('data-value') ?? '').trim();
    const category = $item.find('.event-categorie').first().text().replace(/\s+/g, ' ').trim();
    const timeHtml = $item.find('.event-time').first().html() ?? '';
    const timeLabel = $item.find('.event-time').first().text().replace(/\s+/g, ' ').trim();
    const roomLabel = readRoomLabel(timeHtml);

    entries.push({
      detailUrl,
      sourceEventKey,
      title,
      subtitle,
      teaser,
      listDateLabel,
      category,
      timeLabel,
      roomLabel,
    });
  });

  return entries;
}

export function extractZakkDetailUrlsFromListHtml(html: string): string[] {
  return extractZakkListEntriesFromHtml(html)
    .map((entry) => entry.detailUrl)
    .sort();
}

export function dedupeZakkDetailUrls(urls: readonly string[]): {
  uniqueUrls: string[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  let duplicateCount = 0;
  const uniqueUrls: string[] = [];

  for (const url of urls) {
    const canonical = canonicalizeZakkUrl(url);
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
