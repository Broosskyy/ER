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
import { ZAKK_CONNECTOR_ID, ZAKK_LIST_URL } from './constants';
import { zakkSafeFetchPolicy } from './fetch-policy';
import { parseZakkDetailPage } from './parse-detail';
import {
  dedupeZakkDetailUrls,
  extractZakkDetailUrlsFromListHtml,
  extractZakkListEntriesFromHtml,
  type ZakkListEntry,
} from './parse-list';
import { extractZakkEventId } from './url-policy';

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

export class ZakkOfficialConnector implements OfficialConnector {
  readonly metadata: OfficialConnectorMetadata = {
    connectorId: ZAKK_CONNECTOR_ID,
    sourceType: 'venue_club',
    displayName: 'zakk Official',
    defaultListUrl: ZAKK_LIST_URL,
    capabilities: {
      listDiscovery: true,
      detailFetch: true,
      mediaEnrichment: false,
    },
  };

  discoverFromListHtml(listHtml: string, listUrl: string): OfficialConnectorDiscoveryResult {
    const discovered = extractZakkDetailUrlsFromListHtml(listHtml);
    const { uniqueUrls, duplicateCount } = dedupeZakkDetailUrls(discovered);
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
    const result = await safeFetchHtmlWithPolicy(url, zakkSafeFetchPolicy, options, context);
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
    listEntry?: ZakkListEntry,
  ): OfficialEventEvidence {
    return parseZakkDetailPage(html, finalUrl, fetchedAt, counters, listEntry);
  }

  async runPreview(options: OfficialConnectorRunOptions = {}): Promise<OfficialConnectorRunResult> {
    const counters = createEmptyConnectorCounters();
    const now = options.now?.() ?? new Date();
    const fetchedAt = now.toISOString();
    const writeCache =
      options.writeCache ??
      (async (relativePath: string, contents: string) => {
        const target = `.tmp/${relativePath}`;
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, contents, 'utf8');
      });

    const listResult = await this.fetchHtml(
      ZAKK_LIST_URL,
      { counters },
      { allowListOnly: true },
    );
    await writeCache('m9-1b-zakk-cache/party-list.html', listResult.html);

    const discovery = this.discoverFromListHtml(listResult.html, ZAKK_LIST_URL);
    counters.duplicateListEntries += discovery.duplicateCount;

    const listEntryByUrl = new Map<string, ZakkListEntry>();
    for (const entry of extractZakkListEntriesFromHtml(listResult.html)) {
      listEntryByUrl.set(entry.detailUrl, entry);
    }

    const nowMs = now.getTime();
    const detailUrls = discovery.detailUrls.slice(0, options.maxDetailPages ?? MAX_DETAIL_PAGES);
    const fetchedUrlSet = new Set<string>();

    const previews = await mapWithConcurrency(detailUrls, DETAIL_CONCURRENCY, async (detailUrl) => {
      if (fetchedUrlSet.has(detailUrl)) {
        counters.duplicateDetailFetches += 1;
        throw new Error(`Duplicate detail fetch attempted for ${detailUrl}`);
      }
      fetchedUrlSet.add(detailUrl);

      const listEntry = listEntryByUrl.get(detailUrl);
      const detailResult = await this.fetchHtml(
        detailUrl,
        { counters },
        { allowDetailOnly: true },
      );

      const eventId = extractZakkEventId(detailUrl) ?? 'detail';
      await writeCache(`m9-1b-zakk-cache/details/${eventId}.html`, detailResult.html);

      const evidence = this.parseDetailPage(
        detailResult.html,
        detailResult.finalUrl,
        fetchedAt,
        counters,
        listEntry,
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
      listUrl: ZAKK_LIST_URL,
      discoveredDetailUrls: discovery.detailUrls,
      loadedDetailUrls: [...fetchedUrlSet],
      previews: futurePreviews,
      counters,
      mediaCounters: createEmptyMediaPassCounters(),
    };
  }
}
