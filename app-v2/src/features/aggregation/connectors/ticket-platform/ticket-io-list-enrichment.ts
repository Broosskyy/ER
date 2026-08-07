import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

import { formatTicketPriceFromOverviewText } from './format-ticket-price';
import { parseTicketIoListCardJsonLdBinding } from './ticket-io-shop-alias-discovery';
import { parseTicketIoCardRowContexts } from './ticket-io-list-card-enrichment';
import { normalizeTicketIoListAnchorUrl } from './ticket-io-url';

export interface TicketIoListRowContext {
  eventSlug: string;
  listRowTitle?: string;
  eventDate?: string;
  venueName?: string;
  /** Slug-bound href from the same list card (resolved against the shop root). */
  linkedEventUrl?: string;
  publicTicketPageUrl?: string;
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

export function parseTicketIoListRowContexts(
  html: string,
  shopRootUrl?: string,
): Map<string, TicketIoListRowContext> {
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

    const binding = parseTicketIoListCardJsonLdBinding(rowHtml, eventSlug, shopRootUrl);
    const titleMatch = rowHtml.match(/class="a-eventlink"[^>]*>([^<]+)<\/a>/i);
    const anchorMatch =
      rowHtml.match(/class="a-eventlink"[^>]*href=["']([^"']+)["']/i) ??
      rowHtml.match(/href=["'](\/[A-Za-z0-9]+\/)["'][^>]*class="[^"]*a-eventlink/i);
    const linkedEventUrl = anchorMatch?.[1]
      ? normalizeTicketIoListAnchorUrl(anchorMatch[1], shopRootUrl)
      : shopRootUrl
        ? normalizeTicketIoListAnchorUrl(`/${eventSlug}/`, shopRootUrl)
        : undefined;
    const listRowTitle = binding.listRowTitle ?? (titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]).trim() : undefined);

    contexts.set(eventSlug, {
      eventSlug,
      listRowTitle,
      eventDate: binding.eventDate,
      venueName: binding.venueName,
      linkedEventUrl,
      publicTicketPageUrl: binding.publicTicketPageUrl ?? linkedEventUrl,
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
export function parseAllTicketIoListRowContexts(
  html: string,
  shopRootUrl?: string,
): Map<string, TicketIoListRowContext> {
  const merged = parseTicketIoListRowContexts(html, shopRootUrl);
  for (const [slug, context] of parseTicketIoCardRowContexts(html)) {
    const existing = merged.get(slug);
    const cardHtml = extractCardHtmlForSlug(html, slug);
    const binding = cardHtml
      ? parseTicketIoListCardJsonLdBinding(cardHtml, slug, shopRootUrl)
      : {};
    const enriched = {
      ...context,
      ...existing,
      listRowTitle: binding.listRowTitle ?? existing?.listRowTitle ?? context.listRowTitle,
      eventDate: binding.eventDate ?? existing?.eventDate ?? context.eventDate,
      venueName: binding.venueName ?? existing?.venueName ?? context.venueName,
      linkedEventUrl: existing?.linkedEventUrl ?? context.linkedEventUrl,
      publicTicketPageUrl:
        binding.publicTicketPageUrl ?? existing?.publicTicketPageUrl ?? context.publicTicketPageUrl,
      priceOverviewText: context.priceOverviewText ?? existing?.priceOverviewText,
      priceText: context.priceText ?? existing?.priceText,
      soldOut: context.soldOut ?? existing?.soldOut,
    };
    if (!merged.has(slug) || (!merged.get(slug)?.priceText && enriched.priceText)) {
      merged.set(slug, enriched);
    }
  }
  return merged;
}

function extractCardHtmlForSlug(html: string, slug: string): string | undefined {
  const pattern = new RegExp(
    `<a[^>]+href="/${slug}/"[^>]*class="[^"]*a-eventlink[^"]*"`,
    'i',
  );
  const match = pattern.exec(html);
  if (match?.index === undefined) {
    return undefined;
  }
  return html.slice(Math.max(0, match.index - 500), match.index + 2500);
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
