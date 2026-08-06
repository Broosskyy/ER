import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

import { formatTicketPriceFromOverviewText } from './format-ticket-price';
import type { TicketIoListRowContext } from './ticket-io-list-enrichment';

const EVENT_LINK_PATTERN =
  /<a[^>]+href="\/([A-Za-z0-9]{6,12})\/"[^>]*class="[^"]*a-eventlink[^"]*"/gi;

const PRICE_OVERVIEW_PATTERN =
  /<li class="tio-overview-tickets-from"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/i;

/**
 * Parses newer Ticket.io shop layouts that use Bootstrap rows + event links
 * instead of legacy `event-row-{slug}` table cells.
 */
export function parseTicketIoCardRowContexts(html: string): Map<string, TicketIoListRowContext> {
  const contexts = new Map<string, TicketIoListRowContext>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(EVENT_LINK_PATTERN.source, 'gi');

  while ((match = pattern.exec(html)) !== null) {
    const slug = match[1];
    if (!slug || contexts.has(slug)) {
      continue;
    }

    const afterLink = html.slice(match.index, match.index + 2500);
    const priceMatch = afterLink.match(PRICE_OVERVIEW_PATTERN);
    const priceOverviewText = priceMatch?.[1] ? decodeHtmlEntities(priceMatch[1]) : undefined;
    const soldOut = priceOverviewText ? /ausverkauft|sold\s*out/i.test(priceOverviewText) : false;

    contexts.set(slug, {
      eventSlug: slug,
      priceOverviewText,
      priceText: formatTicketPriceFromOverviewText(priceOverviewText),
      soldOut,
    });
  }

  return contexts;
}
