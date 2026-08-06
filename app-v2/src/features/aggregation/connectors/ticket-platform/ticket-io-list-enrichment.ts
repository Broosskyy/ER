import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

import { formatTicketPriceFromOverviewText } from './format-ticket-price';
import { parseTicketIoCardRowContexts } from './ticket-io-list-card-enrichment';

export interface TicketIoListRowContext {
  eventSlug: string;
  genreText?: string;
  genreNames?: string[];
  priceOverviewText?: string;
  priceText?: string;
  soldOut?: boolean;
}

const EVENT_ROW_PATTERN =
  /<td[^>]*id="event-row-([A-Za-z0-9]+)"[\s\S]*?<\/td>\s*<\/tr>/gi;

const GENRE_INFO_PATTERN =
  /<li[^>]*>[\s\S]*?(?:>info<\/i>[\s\S]*?<span>\s*GENRE\s+([^<]+)<\/span>|>\s*GENRE\s+([^<]+)<\/span>)/i;

const PRICE_OVERVIEW_PATTERN =
  /<li class="tio-overview-tickets-from"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i;

function stripGenreDecorations(value: string): string {
  return value
    .replace(/genre\s*/i, '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseGenreNames(genreText: string | undefined): string[] | undefined {
  if (!genreText) {
    return undefined;
  }
  const cleaned = stripGenreDecorations(decodeHtmlEntities(genreText));
  if (!cleaned) {
    return undefined;
  }
  const parts = cleaned
    .split(/[,/&]|(?:\s+and\s+)/i)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? [...new Set(parts)] : [cleaned];
}

export function parseTicketIoListRowContexts(html: string): Map<string, TicketIoListRowContext> {
  const contexts = new Map<string, TicketIoListRowContext>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(EVENT_ROW_PATTERN.source, 'gi');

  while ((match = pattern.exec(html)) !== null) {
    const eventSlug = match[1];
    const rowHtml = match[0];
    if (!eventSlug) {
      continue;
    }

    const genreMatch = rowHtml.match(GENRE_INFO_PATTERN);
    const genreText = genreMatch?.[1] ?? genreMatch?.[2];
    const decodedGenreText = genreText ? decodeHtmlEntities(genreText) : undefined;
    const priceMatch = rowHtml.match(PRICE_OVERVIEW_PATTERN);
    const priceOverviewText = priceMatch?.[1] ? decodeHtmlEntities(priceMatch[1]) : undefined;
    const soldOut = priceOverviewText ? /ausverkauft|sold\s*out/i.test(priceOverviewText) : false;

    contexts.set(eventSlug, {
      eventSlug,
      genreText: decodedGenreText,
      genreNames: parseGenreNames(decodedGenreText),
      priceOverviewText,
      priceText: formatTicketPriceFromOverviewText(priceOverviewText),
      soldOut,
    });
  }

  return contexts;
}

/** Merges legacy table rows and modern card rows for a Ticket.io shop list page. */
export function parseAllTicketIoListRowContexts(html: string): Map<string, TicketIoListRowContext> {
  const merged = parseTicketIoListRowContexts(html);
  for (const [slug, context] of parseTicketIoCardRowContexts(html)) {
    if (!merged.has(slug) || (!merged.get(slug)?.priceText && context.priceText)) {
      merged.set(slug, { ...merged.get(slug), ...context });
    }
  }
  return merged;
}

export function extractTicketIoEventSlugFromUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const slug = segments[0];
    return slug && /^[A-Za-z0-9]{6,12}$/.test(slug) ? slug : undefined;
  } catch {
    const match = url.match(/\/([A-Za-z0-9]{6,12})\/?(?:\?|#|$)/);
    return match?.[1];
  }
}
