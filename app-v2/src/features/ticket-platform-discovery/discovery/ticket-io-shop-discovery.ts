import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';
import { resolveTicketShopBaseUrl } from '@/features/aggregation/connectors/ticket-platform/normalize-ticket-event';
import type { TicketPlatformSourceConfig } from '@/features/aggregation/connectors/ticket-platform/types';

const TICKET_IO_SHOP_PATTERN =
  /https?:\/\/([a-z0-9][a-z0-9-]*)\.ticket\.io(?:\/[^\s"'<>]*)?/gi;

const IGNORED_SHOP_SLUGS = new Set(['www', 'cdn', 'api', 'help', 'support']);

export interface TicketIoShopCandidate {
  shopSlug: string;
  listUrl: string;
  eventCount: number;
  scopeStats: ReturnType<typeof parseTicketIoShopHtml>['scopeStats'];
}

export function extractTicketIoShopSlugsFromText(corpus: string): string[] {
  const slugs = new Set<string>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(TICKET_IO_SHOP_PATTERN.source, 'gi');
  while ((match = pattern.exec(corpus)) !== null) {
    const slug = (match[1] ?? '').toLowerCase();
    if (!slug || IGNORED_SHOP_SLUGS.has(slug)) {
      continue;
    }
    slugs.add(slug);
  }
  return [...slugs];
}

export async function probeTicketIoShop(
  shopSlug: string,
  scope?: TicketPlatformSourceConfig['scope'],
): Promise<TicketIoShopCandidate | null> {
  const listUrl = resolveTicketShopBaseUrl(shopSlug);
  const response = await defaultHttpClient.fetch(listUrl, {
    headers: {
      'User-Agent': 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) {
    return null;
  }
  const html = await response.text();
  const config: TicketPlatformSourceConfig = {
    platform: 'ticket_io',
    shopSlug,
    listUrl,
    timezone: 'Europe/Berlin',
    limits: { maxEventsPerRun: 100, requestsPerMinute: 15 },
    scope: {
      requireElectronicSignal: true,
      ...scope,
    },
  };
  const { events, scopeStats } = parseTicketIoShopHtml(html, config);
  if (events.length === 0 && scopeStats.discovered === 0) {
    return null;
  }
  return {
    shopSlug,
    listUrl,
    eventCount: events.length,
    scopeStats,
  };
}

export async function discoverTicketIoShops(input: {
  corpusTexts: string[];
  knownShopSlugs: string[];
  scope?: TicketPlatformSourceConfig['scope'];
  maxShops?: number;
}): Promise<TicketIoShopCandidate[]> {
  const discoveredSlugs = new Set<string>();
  for (const text of input.corpusTexts) {
    for (const slug of extractTicketIoShopSlugsFromText(text)) {
      discoveredSlugs.add(slug);
    }
  }
  const known = new Set(input.knownShopSlugs.map((slug) => slug.toLowerCase()));
  const candidates: TicketIoShopCandidate[] = [];
  const maxShops = input.maxShops ?? 20;

  for (const shopSlug of [...discoveredSlugs].filter((slug) => !known.has(slug)).slice(0, maxShops)) {
    const probed = await probeTicketIoShop(shopSlug, input.scope);
    if (probed) {
      candidates.push(probed);
    }
  }

  return candidates;
}
