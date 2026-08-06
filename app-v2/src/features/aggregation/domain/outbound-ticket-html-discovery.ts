import {
  classifyOutboundTicketLink,
  type ClassifiedOutboundTicketLink,
} from '@/features/aggregation/domain/cross-source-ticket-discovery';

const HREF_PATTERN = /href\s*=\s*["']([^"']+)["']/gi;
const DATA_URL_PATTERNS = [
  /data-href\s*=\s*["']([^"']+)["']/gi,
  /data-url\s*=\s*["']([^"']+)["']/gi,
  /data-ticket-url\s*=\s*["']([^"']+)["']/gi,
  /data-link\s*=\s*["']([^"']+)["']/gi,
];
const JSON_LD_BLOCK_PATTERN = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
const TICKET_IO_EVENT_IN_HTML =
  /https?:\/\/[a-z0-9-]+\.ticket\.io\/[A-Za-z0-9]+\/?/gi;
const TICKET_KINGS_EVENT_IN_HTML =
  /https?:\/\/ticketkings\.de\/event\/[a-z0-9-]+\/?/gi;

export function isTicketDestinationUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return /\.ticket\.io|ticketkings\.de\/event\//i.test(trimmed);
  }
  return /\.ticket\.io\/[A-Za-z0-9]+|ticketkings\.de\/event\//i.test(trimmed);
}

function collectUrlsFromPattern(html: string, pattern: RegExp): string[] {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  const flags = pattern.flags.includes('g') ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  while ((match = flags.exec(html)) !== null) {
    const url = match[1] ?? match[0];
    if (url?.trim()) {
      urls.push(url.trim().replace(/&amp;/g, '&'));
    }
  }
  return urls;
}

function extractUrlsFromJsonLd(html: string): string[] {
  const urls: string[] = [];
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = JSON_LD_BLOCK_PATTERN.exec(html)) !== null) {
    const raw = blockMatch[1]?.trim();
    if (!raw) {
      continue;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      walkJsonForUrls(parsed, urls);
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return urls;
}

function walkJsonForUrls(node: unknown, urls: string[]): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      walkJsonForUrls(item, urls);
    }
    return;
  }
  const record = node as Record<string, unknown>;
  for (const [key, value] of Object.entries(record)) {
    if (
      (key === 'url' || key === 'sameAs' || key === 'ticketUrl' || key === 'purchaseUrl') &&
      typeof value === 'string' &&
      /ticket\.io|ticketkings/i.test(value)
    ) {
      urls.push(value);
    }
    if (key === 'offers') {
      const offers = Array.isArray(value) ? value : [value];
      for (const offer of offers) {
        if (offer && typeof offer === 'object') {
          const offerUrl = (offer as Record<string, unknown>).url;
          if (typeof offerUrl === 'string') {
            urls.push(offerUrl);
          }
        }
      }
    }
    walkJsonForUrls(value, urls);
  }
}

export function extractRawTicketUrlsFromHtml(html: string | undefined): string[] {
  if (!html?.trim()) {
    return [];
  }
  const decoded = html.replace(/&amp;/g, '&');
  const urls = new Set<string>();

  for (const url of collectUrlsFromPattern(decoded, HREF_PATTERN)) {
    if (isTicketDestinationUrl(url)) {
      urls.add(url);
    }
  }
  for (const pattern of DATA_URL_PATTERNS) {
    for (const url of collectUrlsFromPattern(decoded, pattern)) {
      if (isTicketDestinationUrl(url)) {
        urls.add(url);
      }
    }
  }
  for (const url of extractUrlsFromJsonLd(decoded)) {
    if (isTicketDestinationUrl(url)) {
      urls.add(url);
    }
  }
  for (const url of decoded.match(TICKET_IO_EVENT_IN_HTML) ?? []) {
    urls.add(url);
  }
  for (const url of decoded.match(TICKET_KINGS_EVENT_IN_HTML) ?? []) {
    urls.add(url);
  }

  return [...urls];
}

export function extractOutboundTicketLinksFromHtml(
  html: string | undefined,
): ClassifiedOutboundTicketLink[] {
  const urls = extractRawTicketUrlsFromHtml(html);
  const classified = urls.map(classifyOutboundTicketLink).filter((entry) => entry.class !== 'unrelated');
  const byUrl = new Map<string, ClassifiedOutboundTicketLink>();
  for (const entry of classified) {
    const existing = byUrl.get(entry.url);
    if (!existing || entry.score > existing.score) {
      byUrl.set(entry.url, entry);
    }
  }
  return [...byUrl.values()].sort((left, right) => right.score - left.score);
}
