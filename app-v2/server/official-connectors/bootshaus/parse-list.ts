import * as cheerio from 'cheerio';

import {
  buildBootshausDetailUrl,
  canonicalizeBootshausUrl,
  extractBootshausDetailSlug,
} from './url-policy';

export function extractBootshausDetailUrlsFromListHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $('a.upcoming-item[href]').each((_index, element) => {
    const href = $(element).attr('href');
    if (!href) {
      return;
    }

    const slug = extractBootshausDetailSlug(href.startsWith('http') ? href : `https://bootshaus.tv${href}`);
    if (!slug) {
      return;
    }

    const detailUrl = buildBootshausDetailUrl(slug);
    if (detailUrl) {
      urls.add(detailUrl);
    }
  });

  return [...urls].sort();
}

export function dedupeDetailUrls(urls: readonly string[]): {
  uniqueUrls: string[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  let duplicateCount = 0;
  const uniqueUrls: string[] = [];

  for (const url of urls) {
    const canonical = canonicalizeBootshausUrl(url);
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
