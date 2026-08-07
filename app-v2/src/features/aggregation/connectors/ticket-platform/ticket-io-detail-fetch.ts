import { extractJsonLdBlocks, collectJsonLdNodes } from '@/features/import/adapters/parsers/json-ld-parser';

import { parseTicketIoListRowContexts } from './ticket-io-list-enrichment';
import { classifyTicketIoDetailHtml } from './ticket-io-detail-classification';
import { extractTicketIoEventSlug } from './ticket-io-url';
import { TicketIoRequestRateLimiter } from './ticket-io-rate-limit';
import type { TicketPlatformSourceConfig } from './types';
import { resolveTicketShopBaseUrl } from './normalize-ticket-event';

export interface TicketIoDetailFetchStats {
  detailUrlsDiscovered: number;
  detailUrlsAttempted: number;
  detailUrlsFetched: number;
  detailUrlsPowBlocked: number;
  detailFetchErrors: number;
  maxDetailPages: number;
  skippedReason?: 'max_detail_pages_zero' | 'wrong_platform' | 'fixture_mode' | 'pow_blocked';
}

export interface TicketIoDetailFetchResult {
  detailHtmlBySlug: Record<string, string>;
  stats: TicketIoDetailFetchStats;
}

const EVENT_ROW_SLUG_PATTERN = /event-row-([A-Za-z0-9]{6,12})/gi;

/** Collect event slugs from list HTML rows, inline ids, and JSON-LD event URLs. */
export function collectTicketIoDetailSlugs(listHtml: string, baseUrl: string): string[] {
  const slugs = new Set<string>();

  for (const slug of parseTicketIoListRowContexts(listHtml).keys()) {
    slugs.add(slug);
  }

  let match: RegExpExecArray | null;
  const rowPattern = new RegExp(EVENT_ROW_SLUG_PATTERN.source, 'gi');
  while ((match = rowPattern.exec(listHtml)) !== null) {
    if (match[1]) {
      slugs.add(match[1]);
    }
  }

  for (const block of extractJsonLdBlocks(listHtml)) {
    for (const node of collectJsonLdNodes(block)) {
      const url = String((node as Record<string, unknown>).url ?? '');
      const offerUrl =
        typeof (node as Record<string, unknown>).offers === 'object' &&
        (node as Record<string, unknown>).offers !== null
          ? String(
              (
                (Array.isArray((node as Record<string, unknown>).offers)
                  ? (node as Record<string, unknown>).offers as unknown[]
                  : [(node as Record<string, unknown>).offers]
                )[0] as Record<string, unknown>
              )?.url ?? '',
            )
          : '';
      for (const candidate of [url, offerUrl]) {
        if (!candidate?.trim()) continue;
        const slug = extractTicketIoEventSlug(candidate);
        if (slug) {
          slugs.add(slug);
        }
      }
    }
  }

  return [...slugs];
}

export async function fetchTicketIoDetailPagesWithAudit(input: {
  listHtml: string;
  config: TicketPlatformSourceConfig;
  userAgent: string;
  rateLimiter: TicketIoRequestRateLimiter;
  fetchHtml: (url: string) => Promise<string>;
}): Promise<TicketIoDetailFetchResult> {
  const maxDetailPages = input.config.limits?.maxDetailPages ?? 0;
  const baseUrl = input.config.listUrl ?? resolveTicketShopBaseUrl(input.config.shopSlug);

  if (maxDetailPages <= 0 || input.config.platform !== 'ticket_io') {
    return {
      detailHtmlBySlug: {},
      stats: {
        detailUrlsDiscovered: 0,
        detailUrlsAttempted: 0,
        detailUrlsFetched: 0,
        detailUrlsPowBlocked: 0,
        detailFetchErrors: 0,
        maxDetailPages,
        skippedReason: maxDetailPages <= 0 ? 'max_detail_pages_zero' : 'wrong_platform',
      },
    };
  }

  const slugs = collectTicketIoDetailSlugs(input.listHtml, baseUrl);
  const detailHtmlBySlug: Record<string, string> = {};
  let detailUrlsAttempted = 0;
  let detailUrlsFetched = 0;
  let detailUrlsPowBlocked = 0;
  let detailFetchErrors = 0;

  for (const slug of slugs) {
    if (detailUrlsFetched >= maxDetailPages) {
      break;
    }
    const detailUrl = `${baseUrl.replace(/\/?$/, '')}/${slug}/`;
    detailUrlsAttempted += 1;
    try {
      const html = await input.fetchHtml(detailUrl);
      if (classifyTicketIoDetailHtml(html).detailFetchStatus === 'pow_challenge') {
        detailUrlsPowBlocked += 1;
        continue;
      }
      detailHtmlBySlug[slug] = html;
      detailUrlsFetched += 1;
    } catch {
      detailFetchErrors += 1;
    }
  }

  return {
    detailHtmlBySlug,
    stats: {
      detailUrlsDiscovered: slugs.length,
      detailUrlsAttempted,
      detailUrlsFetched,
      detailUrlsPowBlocked,
      detailFetchErrors,
      maxDetailPages,
      ...(detailUrlsFetched === 0 &&
      detailUrlsAttempted > 0 &&
      detailUrlsPowBlocked >= detailUrlsAttempted
        ? { skippedReason: 'pow_blocked' as const }
        : {}),
    },
  };
}
