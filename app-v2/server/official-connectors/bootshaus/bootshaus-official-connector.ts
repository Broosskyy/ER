import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type {
  OfficialConnector,
  OfficialConnectorDiscoveryResult,
  OfficialConnectorFetchResult,
  OfficialConnectorMetadata,
  OfficialConnectorRunOptions,
  OfficialConnectorRunResult,
} from '../connector-contract';
import {
  createEmptyMediaPassCounters,
  finalizeOfficialEventEvidence,
  terminateSharedTesseractWorker,
} from '../media-evidence';
import { buildConsumerPreview } from '../preview';
import { resetTicketFetchCache } from '../ticket-evidence/ticket-evidence-pipeline';
import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';
import { safeFetchHtml } from '../safe-fetch';
import type { SafeFetchRequestContext, SafeFetchRequestOptions } from '../generic-safe-fetch';
import {
  createEmptyConnectorCounters,
  type ConnectorErrorCounters,
  type OfficialEventConsumerPreview,
  type OfficialEventEvidence,
} from '../types';
import { BOOTSHAUS_CONNECTOR_ID, BOOTSHAUS_LIST_URL } from './constants';
import { buildBootshausMediaEvidenceContext } from './build-bootshaus-media-evidence';
import { parseBootshausDetailPage } from './parse-detail';
import { dedupeDetailUrls, extractBootshausDetailUrlsFromListHtml } from './parse-list';
import { markPastOfficialEventIfNeeded } from '../shared/mark-past-official-event';

const MAX_DETAIL_PAGES = 40;
const DETAIL_CONCURRENCY = 3;

export interface BootshausConnectorRunOptions extends OfficialConnectorRunOptions {}

export interface BootshausConnectorRunResult extends OfficialConnectorRunResult {}

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex] as TInput);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export class BootshausOfficialConnector implements OfficialConnector {
  readonly metadata: OfficialConnectorMetadata = {
    connectorId: BOOTSHAUS_CONNECTOR_ID,
    sourceType: 'venue_club',
    displayName: 'Bootshaus Official',
    defaultListUrl: BOOTSHAUS_LIST_URL,
    capabilities: {
      listDiscovery: true,
      detailFetch: true,
      mediaEnrichment: true,
    },
  };

  discoverFromListHtml(listHtml: string, listUrl: string): OfficialConnectorDiscoveryResult {
    const discovered = extractBootshausDetailUrlsFromListHtml(listHtml);
    const { uniqueUrls, duplicateCount } = dedupeDetailUrls(discovered);
    return {
      listUrl,
      detailUrls: uniqueUrls,
      duplicateCount,
    };
  }

  async fetchHtml(
    url: string,
    options: SafeFetchRequestOptions,
    context: SafeFetchRequestContext = {},
  ): Promise<OfficialConnectorFetchResult> {
    const counters = options.counters as ConnectorErrorCounters;
    return safeFetchHtml(url, {
      ...options,
      counters,
      allowListOnly: context.allowListOnly,
      allowDetailOnly: context.allowDetailOnly,
    });
  }

  parseDetailPage(
    html: string,
    finalUrl: string,
    fetchedAt: string,
    counters: ConnectorErrorCounters,
  ): OfficialEventEvidence {
    return parseBootshausDetailPage(html, finalUrl, fetchedAt, counters);
  }

  async runPreview(options: BootshausConnectorRunOptions = {}): Promise<BootshausConnectorRunResult> {
    const counters = createEmptyConnectorCounters();
    const mediaCounters = createEmptyMediaPassCounters();
    const allowedImageHosts = new Set<string>();
    const fetchedAt = (options.now?.() ?? new Date()).toISOString();
    const writeCache =
      options.writeCache ??
      (async (relativePath: string, contents: string) => {
        const target = `.tmp/${relativePath}`;
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, contents, 'utf8');
      });

    const listResult = await this.fetchHtml(
      BOOTSHAUS_LIST_URL,
      { counters },
      { allowListOnly: true },
    );
    await writeCache('m3-bootshaus-cache/list.html', listResult.html);

    const discovery = this.discoverFromListHtml(listResult.html, BOOTSHAUS_LIST_URL);
    counters.duplicateListEntries += discovery.duplicateCount;

    const detailUrls = discovery.detailUrls.slice(0, options.maxDetailPages ?? MAX_DETAIL_PAGES);
    const fetchedUrlSet = new Set<string>();

    const ticketResults: VerifiedTicketCompleteResult[] = [];
    resetTicketFetchCache();

    const previews = await mapWithConcurrency(detailUrls, DETAIL_CONCURRENCY, async (detailUrl) => {
      if (fetchedUrlSet.has(detailUrl)) {
        counters.duplicateDetailFetches += 1;
        throw new Error(`Duplicate detail fetch attempted for ${detailUrl}`);
      }
      fetchedUrlSet.add(detailUrl);

      const detailResult = await this.fetchHtml(
        detailUrl,
        { counters },
        { allowDetailOnly: true },
      );

      const slug = new URL(detailResult.finalUrl).pathname.split('/').filter(Boolean)[1] ?? 'unknown';
      await writeCache(`m3-bootshaus-cache/details/${slug}.html`, detailResult.html);

      let textEvidence = this.parseDetailPage(
        detailResult.html,
        detailResult.finalUrl,
        fetchedAt,
        counters,
      );

      textEvidence = markPastOfficialEventIfNeeded(textEvidence);

      const finalized = await finalizeOfficialEventEvidence({
        evidence: textEvidence,
        prefetchedHtml: detailResult.html,
        fetchedAt,
        counters,
        mediaCounters,
        allowedImageHosts,
        buildMediaContext: buildBootshausMediaEvidenceContext,
        processTickets: Boolean(textEvidence.linkedTicketUrl),
      });
      if (finalized.ticketResult && !textEvidence.enrichmentGaps.includes('past_event_skipped')) {
        ticketResults.push(finalized.ticketResult);
      }

      return buildConsumerPreview(finalized.evidence, counters);
    });

    await terminateSharedTesseractWorker();

    const futurePreviews = previews.filter(
      (preview) => !preview.enrichmentGaps.includes('past_event_skipped'),
    );

    return {
      fetchedAt,
      listUrl: BOOTSHAUS_LIST_URL,
      discoveredDetailUrls: discovery.detailUrls,
      loadedDetailUrls: [...fetchedUrlSet],
      previews: futurePreviews,
      counters,
      mediaCounters,
      ticketResults,
    };
  }
}
