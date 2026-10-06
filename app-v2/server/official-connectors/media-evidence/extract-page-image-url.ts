import * as cheerio from 'cheerio';

function normalizeImageUrl(raw: string | undefined, pageUrl: string): string | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  try {
    const resolved = new URL(raw.trim(), pageUrl);
    if (resolved.protocol !== 'https:') {
      return undefined;
    }
    return resolved.toString();
  } catch {
    return undefined;
  }
}

export function extractPrimaryPageImageUrl(body: string, pageUrl: string): string | undefined {
  const $ = cheerio.load(body);
  const ogImage = normalizeImageUrl($('meta[property="og:image"]').attr('content'), pageUrl);
  if (ogImage) {
    return ogImage;
  }

  const selectors = [
    'img.event-flyer',
    'img.flyer',
    '.event-image img',
    '.nm-event-image img',
    '.ecm-event-single__flyer',
    '.upcoming-image.detail img',
    'article img[src*="flyer"]',
    'article img[src*="event"]',
  ];

  for (const selector of selectors) {
    const src = normalizeImageUrl($(selector).first().attr('src'), pageUrl);
    if (src) {
      return src;
    }
  }

  return undefined;
}
