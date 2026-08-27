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
import { safeFetchHtmlWithPolicy } from '../generic-safe-fetch';
import type { SafeFetchRequestContext, SafeFetchRequestOptions } from '../generic-safe-fetch';
import { createEmptyMediaPassCounters } from '../media-evidence';
import { buildConsumerPreview } from '../preview';
import {
  createEmptyConnectorCounters,
  type ConnectorErrorCounters,
  type OfficialEventConsumerPreview,
  type OfficialEventEvidence,
} from '../types';
import {
  NACHTRESIDENZ_CONNECTOR_ID,
  NACHTRESIDENZ_LIST_URL,
} from './constants';
import { nachtresidenzSafeFetchPolicy } from './fetch-policy';
import { parseNachtresidenzDetailPage } from './parse-detail';
import {
  dedupeNachtresidenzDetailUrls,
  extractNachtresidenzDetailUrlsFromListHtml,
} from './parse-list';
import { isNachtresidenzEventUrl } from './url-policy';

const MAX_DETAIL_PAGES = 40;
const DETAIL_CONCURRENCY = 3;

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

export class NachtresidenzOfficialConnector implements OfficialConnector {
  private listHtmlCache: string | null = null;
  private listFinalUrl: string | null = null;

  readonly metadata: OfficialConnectorMetadata = {
    connectorId: NACHTRESIDENZ_CONNECTOR_ID,
    sourceType: 'venue_club',
    displayName: 'Nachtresidenz Official',
    defaultListUrl: NACHTRESIDENZ_LIST_URL,
    capabilities: {
      listDiscovery: true,
      detailFetch: true,
      mediaEnrichment: false,
    },
  };

  discoverFromListHtml(listHtml: string, listUrl: string): OfficialConnectorDiscoveryResult {
    const discovered = extractNachtresidenzDetailUrlsFromListHtml(listHtml);
    const { uniqueUrls, duplicateCount } = dedupeNachtresidenzDetailUrls(discovered);
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
    if (isNachtresidenzEventUrl(url)) {
      if (!this.listHtmlCache) {
        const listResult = await safeFetchHtmlWithPolicy(
          NACHTRESIDENZ_LIST_URL,
          nachtresidenzSafeFetchPolicy,
          options,
          { ...context, allowListOnly: true },
        );
        this.listHtmlCache = listResult.html;
        this.listFinalUrl = listResult.finalUrl;
      }
      return {
        finalUrl: url,
        html: this.listHtmlCache,
        contentType: 'text/html',
      };
    }

    const result = await safeFetchHtmlWithPolicy(url, nachtresidenzSafeFetchPolicy, options, context);
    if (!isNachtresidenzEventUrl(url)) {
      this.listHtmlCache = result.html;
      this.listFinalUrl = result.finalUrl;
    }
    return {
      finalUrl: result.finalUrl,
      html: result.html,
      contentType: result.contentType,
    };
  }

  parseDetailPage(
    html: string,
    finalUrl: string,
    fetchedAt: string,
    counters: ConnectorErrorCounters,
  ): OfficialEventEvidence {
    return parseNachtresidenzDetailPage(html, finalUrl, fetchedAt, counters);
  }

  async runPreview(options: OfficialConnectorRunOptions = {}): Promise<OfficialConnectorRunResult> {
    this.listHtmlCache = null;
    this.listFinalUrl = null;

    const counters = createEmptyConnectorCounters();
    const fetchedAt = (options.now?.() ?? new Date()).toISOString();
    const writeCache =
      options.writeCache ??
      (async (relativePath: string, contents: string) => {
        const target = `.tmp/${relativePath}`;
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, contents, 'utf8');
      });

    const listResult = await this.fetchHtml(
      NACHTRESIDENZ_LIST_URL,
      { counters },
      { allowListOnly: true },
    );
    await writeCache('m9-1b-nachtresidenz-cache/list.html', listResult.html);

    const discovery = this.discoverFromListHtml(listResult.html, NACHTRESIDENZ_LIST_URL);
    counters.duplicateListEntries += discovery.duplicateCount;

    const nowMs = Date.parse(fetchedAt);
    const detailUrls = discovery.detailUrls.slice(0, options.maxDetailPages ?? MAX_DETAIL_PAGES);
    const fetchedUrlSet = new Set<string>();

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

      const slug = detailUrl.split('/').filter(Boolean).slice(-2).join('-');
      await writeCache(`m9-1b-nachtresidenz-cache/details/${slug}.html`, detailResult.html);

      const evidence = this.parseDetailPage(
        detailResult.html,
        detailResult.finalUrl,
        fetchedAt,
        counters,
      );

      if (evidence.startsAt && Date.parse(evidence.startsAt) < nowMs) {
        evidence.enrichmentGaps = [...new Set([...evidence.enrichmentGaps, 'past_event_skipped'])];
      }

      return buildConsumerPreview(evidence, counters);
    });

    const futurePreviews = previews.filter(
      (preview) => !preview.enrichmentGaps.includes('past_event_skipped'),
    );

    return {
      fetchedAt,
      listUrl: NACHTRESIDENZ_LIST_URL,
      discoveredDetailUrls: discovery.detailUrls,
      loadedDetailUrls: [...fetchedUrlSet],
      previews: futurePreviews,
      counters,
      mediaCounters: createEmptyMediaPassCounters(),
    };
  }
}
