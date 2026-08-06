import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import { extractTicketIoShopSlugsFromText } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { TicketIoRequestRateLimiter } from '@/features/aggregation/connectors/ticket-platform/ticket-io-rate-limit';
import { probeTicketIoShopUrl } from '@/features/ticket-platform-discovery/discovery/ticket-io-probe';
import { listTicketIoSeedSlugs } from '@/features/ticket-platform-discovery/discovery/ticket-io-seed-urls';
import type { TicketPlatformSourceConfig } from '@/features/aggregation/connectors/ticket-platform/types';

export { extractTicketIoShopSlugsFromText };

export interface TicketIoShopCandidate {
  shopSlug: string;
  listUrl: string;
  eventCount: number;
  scopeStats: ReturnType<typeof parseTicketIoShopHtml>['scopeStats'];
}

const sharedRateLimiter = TicketIoRequestRateLimiter.fromRequestsPerMinute(15);

function countImportableEvents(scopeStats: TicketIoShopCandidate['scopeStats']): number {
  return scopeStats.accepted + (scopeStats.uncertain ?? 0);
}

export async function probeTicketIoShop(
  shopSlug: string,
  scope?: TicketPlatformSourceConfig['scope'],
): Promise<TicketIoShopCandidate | null> {
  await sharedRateLimiter.waitForSlot();
  const probed = await probeTicketIoShopUrl(shopSlug, scope);
  if (!probed) {
    return null;
  }
  const importable = countImportableEvents(probed.scopeStats);
  if (importable === 0) {
    return null;
  }
  return {
    shopSlug: probed.shopSlug,
    listUrl: probed.listUrl,
    eventCount: importable,
    scopeStats: probed.scopeStats,
  };
}

export async function discoverTicketIoShops(input: {
  corpusTexts: string[];
  knownShopSlugs: string[];
  scope?: TicketPlatformSourceConfig['scope'];
  maxShops?: number;
  includeSeedShops?: boolean;
  excludeShopSlugs?: string[];
}): Promise<TicketIoShopCandidate[]> {
  const discoveredSlugs = new Set<string>();
  for (const text of input.corpusTexts) {
    for (const slug of extractTicketIoShopSlugsFromText(text)) {
      discoveredSlugs.add(slug);
    }
  }
  if (input.includeSeedShops !== false) {
    for (const slug of listTicketIoSeedSlugs()) {
      discoveredSlugs.add(slug);
    }
  }

  const known = new Set(input.knownShopSlugs.map((slug) => slug.toLowerCase()));
  const excluded = new Set((input.excludeShopSlugs ?? []).map((slug) => slug.toLowerCase()));
  const candidates: TicketIoShopCandidate[] = [];
  const maxShops = input.maxShops ?? 30;

  const slugsToProbe = [...discoveredSlugs]
    .filter((slug) => !known.has(slug) && !excluded.has(slug))
    .slice(0, maxShops);

  for (const shopSlug of slugsToProbe) {
    const probed = await probeTicketIoShop(shopSlug, input.scope);
    if (probed) {
      candidates.push(probed);
    }
  }

  return candidates;
}
