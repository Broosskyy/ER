import { parseTicketKingsShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter';
import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';
import type {
  ParsedTicketPlatformEvent,
  TicketPlatformScopeStats,
  TicketPlatformSourceConfig,
} from '@/features/aggregation/connectors/ticket-platform/types';

export const TICKET_KINGS_PLATFORM_LIST_URL = 'https://ticketkings.de/all-events/';

const DEFAULT_USER_AGENT = 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)';

export interface TicketKingsPlatformCrawlResult {
  pagesCrawled: number;
  rawEvents: ParsedTicketPlatformEvent[];
  acceptedEvents: ParsedTicketPlatformEvent[];
  scopeStats: TicketPlatformScopeStats;
  organizers: Map<string, number>;
  venues: Map<string, number>;
  limitations: string[];
}

function mergeScopeStats(target: TicketPlatformScopeStats, next: TicketPlatformScopeStats): void {
  target.discovered += next.discovered;
  target.accepted += next.accepted;
  target.rejected += next.rejected;
  for (const [reason, count] of Object.entries(next.rejectionReasons)) {
    target.rejectionReasons[reason] = (target.rejectionReasons[reason] ?? 0) + count;
  }
}

function recordEntity(map: Map<string, number>, value: string | undefined): void {
  if (!value?.trim()) {
    return;
  }
  const key = value.trim();
  map.set(key, (map.get(key) ?? 0) + 1);
}

function extractNextPageUrl(html: string, currentUrl: string): string | null {
  const pageMatch = html.match(/all-events\/page\/(\d+)/i);
  if (!pageMatch?.[1]) {
    return null;
  }
  const currentPage = Number(currentUrl.match(/\/page\/(\d+)\/?$/i)?.[1] ?? 1);
  const maxPage = Number(pageMatch[1]);
  const nextPage = currentPage + 1;
  if (nextPage > maxPage) {
    return null;
  }
  return `https://ticketkings.de/all-events/page/${nextPage}/`;
}

export async function crawlTicketKingsPlatform(input?: {
  listUrl?: string;
  maxPages?: number;
  scope?: TicketPlatformSourceConfig['scope'];
}): Promise<TicketKingsPlatformCrawlResult> {
  const config: TicketPlatformSourceConfig = {
    platform: 'ticket_king',
    shopSlug: 'ticketkings',
    listUrl: input?.listUrl ?? TICKET_KINGS_PLATFORM_LIST_URL,
    timezone: 'Europe/Berlin',
    limits: { maxEventsPerRun: 500, requestsPerMinute: 15 },
    scope: {
      requireElectronicSignal: true,
      ...input?.scope,
    },
  };

  const limitations = [
    'Ticket Kings exposes a single-operator platform list at /all-events/ (no public API).',
    'Pagination is HTML-based; crawler follows /all-events/page/N/ when present.',
    'iCal feed exists but is not used — JSON-LD list parsing reuses ticket_king adapter.',
  ];

  const rawById = new Map<string, ParsedTicketPlatformEvent>();
  const acceptedById = new Map<string, ParsedTicketPlatformEvent>();
  const organizers = new Map<string, number>();
  const venues = new Map<string, number>();
  const mergedStats: TicketPlatformScopeStats = {
    discovered: 0,
    accepted: 0,
    rejected: 0,
    rejectionReasons: {},
  };

  let url: string | null = config.listUrl ?? TICKET_KINGS_PLATFORM_LIST_URL;
  let pagesCrawled = 0;
  const maxPages = input?.maxPages ?? 10;

  while (url && pagesCrawled < maxPages) {
    const response = await defaultHttpClient.fetch(url, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) {
      limitations.push(`Fetch failed (${response.status}) for ${url}`);
      break;
    }

    const html = await response.text();
    const parsed = parseTicketKingsShopHtml(html, config);
    mergeScopeStats(mergedStats, parsed.scopeStats);
    pagesCrawled += 1;

    for (const event of parsed.events) {
      acceptedById.set(event.externalId, event);
      recordEntity(organizers, event.organizerName);
      recordEntity(venues, event.venueName);
    }

    const allEventUrls = [...html.matchAll(/ticketkings\.de\/event\/[^"'\s]+/gi)].map((m) => m[0]);
    for (const eventUrl of new Set(allEventUrls)) {
      rawById.set(eventUrl, {
        externalId: eventUrl,
        title: eventUrl.split('/').filter(Boolean).pop() ?? eventUrl,
        startDate: '',
        timezone: config.timezone ?? 'Europe/Berlin',
        ticketUrl: eventUrl,
        eventUrl: eventUrl,
        platform: 'ticket_king',
        shopSlug: config.shopSlug,
      });
    }

    url = extractNextPageUrl(html, url);
  }

  return {
    pagesCrawled,
    rawEvents: [...rawById.values()],
    acceptedEvents: [...acceptedById.values()],
    scopeStats: mergedStats,
    organizers,
    venues,
    limitations,
  };
}
