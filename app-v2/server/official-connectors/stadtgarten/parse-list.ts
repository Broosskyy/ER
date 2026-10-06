import * as cheerio from 'cheerio';
import type { Element } from 'domhandler';

import {
  canonicalizeStadtgartenUrl,
  extractStadtgartenEventId,
} from './url-policy';
import { splitPublishedGenreLabels } from './parse-scope';

export interface StadtgartenListEntry {
  detailUrl: string;
  sourceEventKey: string;
  title: string;
  categories: string[];
  genreLabel: string;
  genreLabels: string[];
  listTimeLabel: string;
}

function readCardCategories(
  $: cheerio.CheerioAPI,
  $card: cheerio.Cheerio<Element>,
): string[] {
  const categories: string[] = [];
  $card.find('.mono.block.mt1 span.category').each((_index, element) => {
    const value = $(element).text().replace(/\s+/g, ' ').trim();
    if (value) {
      categories.push(value);
    }
  });
  return categories;
}

function readCardGenreLabel($card: cheerio.Cheerio<Element>): string {
  return $card.find('div.block.bold').first().text().replace(/\s+/g, ' ').trim();
}

function readCardTimeLabel($card: cheerio.Cheerio<Element>): string {
  const monoBlock = $card.find('.mono.block.mt1').first().text().replace(/\s+/g, ' ').trim();
  const categoryMatch = monoBlock.match(/^(\d{1,2}:\d{2})/);
  return categoryMatch?.[1] ?? '';
}

export function extractStadtgartenListEntriesFromHtml(html: string): StadtgartenListEntry[] {
  const $ = cheerio.load(html);
  const entries: StadtgartenListEntry[] = [];

  $('article.card_event_fancy.index').each((_index, article) => {
    const $card = $(article);
    const href = $card.find('a[href*="/programm/"]').first().attr('href');
    if (!href) {
      return;
    }

    const detailUrl = canonicalizeStadtgartenUrl(href);
    if (!detailUrl) {
      return;
    }

    const sourceEventKey = extractStadtgartenEventId(detailUrl);
    if (!sourceEventKey) {
      return;
    }

    const title = $card.find('h4.m0').first().text().replace(/\s+/g, ' ').trim();
    const genreLabel = readCardGenreLabel($card);
    const categories = readCardCategories($, $card);

    entries.push({
      detailUrl,
      sourceEventKey,
      title,
      categories,
      genreLabel,
      genreLabels: splitPublishedGenreLabels(genreLabel),
      listTimeLabel: readCardTimeLabel($card),
    });
  });

  return entries;
}

export function extractStadtgartenDetailUrlsFromListHtml(html: string): string[] {
  return extractStadtgartenListEntriesFromHtml(html)
    .map((entry) => entry.detailUrl)
    .sort();
}

export function dedupeStadtgartenDetailUrls(urls: readonly string[]): {
  uniqueUrls: string[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  let duplicateCount = 0;
  const uniqueUrls: string[] = [];

  for (const url of urls) {
    const canonical = canonicalizeStadtgartenUrl(url);
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
