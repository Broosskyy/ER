import { resolveRelativeUrl } from '@/features/aggregation/connectors/website/security';
import { extractLinks } from '@/features/aggregation/connectors/website/html-utils';
import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import type { WebsiteDocument } from '@/features/aggregation/connectors/website/types';
import type { WebsiteRunLimits } from '@/features/aggregation/connectors/website/limits';

export interface WebsitePaginationState {
  visitedUrls: Set<string>;
  pagesFetched: number;
  stopReason?: 'max_pages' | 'duplicate_url' | 'empty_page' | 'repeated_content';
}

export function createPaginationState(): WebsitePaginationState {
  return {
    visitedUrls: new Set<string>(),
    pagesFetched: 0,
  };
}

export function resolveNextPageUrl(
  document: WebsiteDocument,
  config: WebsiteConnectorConfig,
): string | null {
  const selector = config.htmlSelector?.nextPageSelector ?? 'a[rel="next"]';
  const href = extractLinks(document.html, selector, 'href')[0];
  if (!href) {
    return null;
  }
  return resolveRelativeUrl(document.finalUrl, href);
}

export function shouldStopPagination(
  state: WebsitePaginationState,
  limits: WebsiteRunLimits,
  nextUrl: string | null,
  pageHasContent: boolean,
  contentHash?: string,
  previousHash?: string,
): boolean {
  if (state.pagesFetched >= limits.maxPaginationPages) {
    state.stopReason = 'max_pages';
    return true;
  }
  if (!nextUrl) {
    return true;
  }
  if (state.visitedUrls.has(nextUrl)) {
    state.stopReason = 'duplicate_url';
    return true;
  }
  if (!pageHasContent) {
    state.stopReason = 'empty_page';
    return true;
  }
  if (contentHash && previousHash && contentHash === previousHash) {
    state.stopReason = 'repeated_content';
    return true;
  }
  return false;
}

export function markPaginationVisit(state: WebsitePaginationState, url: string): void {
  state.visitedUrls.add(url);
  state.pagesFetched += 1;
}
