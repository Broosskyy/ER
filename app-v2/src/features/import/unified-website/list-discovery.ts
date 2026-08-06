import type { ListDiscoveryResult } from './types';
import { resolveProviderAdapter } from './provider-adapters';

function collectEventUrls(html: string, pattern: RegExp, listPageUrl: string): string[] {
  const urls = new Set<string>();
  let match: RegExpExecArray | null;
  const flags = pattern.flags.includes('g') ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  while ((match = flags.exec(html)) !== null) {
    const raw = match[1] ?? match[0];
    if (!raw?.trim()) continue;
    try {
      const absolute = new URL(raw.trim(), listPageUrl).href;
      urls.add(absolute.replace(/\/$/, ''));
    } catch {
      // skip invalid URLs
    }
  }
  return [...urls].sort();
}

/**
 * Generic list-page discovery driven by provider adapter configuration.
 */
export function discoverEventUrlsFromListPage(
  html: string,
  listPageUrl: string,
  eventLinkPattern: RegExp,
  strategy: string,
): ListDiscoveryResult {
  const discoveredUrls = collectEventUrls(html, eventLinkPattern, listPageUrl);
  return {
    listPageUrl,
    discoveredUrls,
    strategy,
    diagnostics:
      discoveredUrls.length === 0
        ? [
            {
              code: 'LIST_DISCOVERY_EMPTY',
              message: `No event URLs matched on list page ${listPageUrl}`,
              surface: 'list',
            },
          ]
        : [],
  };
}

export function discoverEventUrlsForHost(html: string, hostUrl: string): ListDiscoveryResult | undefined {
  const adapter = resolveProviderAdapter(hostUrl);
  if (!adapter?.listDiscovery) {
    return undefined;
  }
  const { listPageUrl, eventLinkPattern, strategy } = adapter.listDiscovery;
  return discoverEventUrlsFromListPage(html, listPageUrl, eventLinkPattern, strategy);
}
