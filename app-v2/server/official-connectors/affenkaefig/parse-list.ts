import * as cheerio from 'cheerio';

import {
  buildAffenkaefigDetailUrl,
  canonicalizeAffenkaefigUrl,
  extractAffenkaefigDetailSlug,
} from './url-policy';

export function extractAffenkaefigDetailUrlsFromListHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $('a[href]').each((_index, element) => {
    const href = $(element).attr('href');
    if (!href) {
      return;
    }

    const slug = extractAffenkaefigDetailSlug(
      href.startsWith('http') ? href : `https://affenkaefig.info${href}`,
    );
    if (!slug) {
      return;
    }

    const detailUrl = buildAffenkaefigDetailUrl(slug);
    if (detailUrl) {
      urls.add(detailUrl);
    }
  });

  return [...urls].sort();
}

export function dedupeAffenkaefigDetailUrls(urls: readonly string[]): {
  uniqueUrls: string[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  let duplicateCount = 0;
  const uniqueUrls: string[] = [];

  for (const url of urls) {
    const canonical = canonicalizeAffenkaefigUrl(url);
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
