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
import { buildMonthCalendarUrls } from '../shared/month-calendar-urls';
import {
  createEmptyConnectorCounters,
  type ConnectorErrorCounters,
  type OfficialEventConsumerPreview,
  type OfficialEventEvidence,
} from '../types';
import {
  STADTGARTEN_CONNECTOR_ID,
  STADTGARTEN_FORWARD_MONTH_COUNT,
  STADTGARTEN_LIST_URL,
  STADTGARTEN_MONTH_PATH_TEMPLATE,
} from './constants';
import { stadtgartenSafeFetchPolicy } from './fetch-policy';
import { parseStadtgartenDetailPage } from './parse-detail';
import {
  dedupeStadtgartenDetailUrls,
  extractStadtgartenDetailUrlsFromListHtml,
  extractStadtgartenListEntriesFromHtml,
  type StadtgartenListEntry,
} from './parse-list';
import { assessStadtgartenScope } from './parse-scope';

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

function buildListMonthUrls(now: Date): string[] {
  return buildMonthCalendarUrls({
    baseListUrl: STADTGARTEN_LIST_URL,
    monthPathTemplate: STADTGARTEN_MONTH_PATH_TEMPLATE,
    startYear: now.getFullYear(),
    startMonth: now.getMonth() + 1,
    monthCount: STADTGARTEN_FORWARD_MONTH_COUNT,
  });
}

function shouldSkipScopeFromListEntry(entry: StadtgartenListEntry): boolean {
  return assessStadtgartenScope(entry.categories, entry.genreLabels) === 'outside_scope';
}

export class StadtgartenOfficialConnector implements OfficialConnector {
  readonly metadata: OfficialConnectorMetadata = {
    connectorId: STADTGARTEN_CONNECTOR_ID,
    sourceType: 'venue_club',
    displayName: 'Stadtgarten Official',
    defaultListUrl: STADTGARTEN_LIST_URL,
    capabilities: {
      listDiscovery: true,
      detailFetch: true,
      mediaEnrichment: false,
    },
  };

  discoverFromListHtml(listHtml: string, listUrl: string): OfficialConnectorDiscoveryResult {
    const discovered = extractStadtgartenDetailUrlsFromListHtml(listHtml);
    const { uniqueUrls, duplicateCount } = dedupeStadtgartenDetailUrls(discovered);
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
    const result = await safeFetchHtmlWithPolicy(url, stadtgartenSafeFetchPolicy, options, context);
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
    listEntry?: StadtgartenListEntry,
  ): OfficialEventEvidence {
    return parseStadtgartenDetailPage(html, finalUrl, fetchedAt, counters, listEntry);
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

    const listUrls = buildListMonthUrls(now);
    const listEntryByUrl = new Map<string, StadtgartenListEntry>();
    const discoveredDetailUrls: string[] = [];

    for (const listUrl of listUrls) {
      const listResult = await this.fetchHtml(
        listUrl,
        { counters },
        { allowListOnly: true },
      );
      const monthMatch = listUrl.match(/year:(\d{4})\/month:(\d{2})/i);
      const monthSlug = monthMatch ? `${monthMatch[1]}-${monthMatch[2]}` : listUrl.split('/').filter(Boolean).slice(-1)[0] ?? 'list';
      await writeCache(`m9-1b-stadtgarten-cache/lists/${monthSlug}.html`, listResult.html);

      const discovery = this.discoverFromListHtml(listResult.html, listUrl);
      counters.duplicateListEntries += discovery.duplicateCount;
      discoveredDetailUrls.push(...discovery.detailUrls);

      for (const entry of extractStadtgartenListEntriesFromHtml(listResult.html)) {
        listEntryByUrl.set(entry.detailUrl, entry);
      }
    }

    const { uniqueUrls, duplicateCount } = dedupeStadtgartenDetailUrls(discoveredDetailUrls);
    counters.duplicateListEntries += duplicateCount;

    const nowMs = now.getTime();
    const detailUrls = uniqueUrls.slice(0, options.maxDetailPages ?? MAX_DETAIL_PAGES);
    const fetchedUrlSet = new Set<string>();

    const previews = await mapWithConcurrency(detailUrls, DETAIL_CONCURRENCY, async (detailUrl) => {
      if (fetchedUrlSet.has(detailUrl)) {
        counters.duplicateDetailFetches += 1;
        throw new Error(`Duplicate detail fetch attempted for ${detailUrl}`);
      }
      fetchedUrlSet.add(detailUrl);

      const listEntry = listEntryByUrl.get(detailUrl);
      if (listEntry && shouldSkipScopeFromListEntry(listEntry)) {
        return null;
      }

      const detailResult = await this.fetchHtml(
        detailUrl,
        { counters },
        { allowDetailOnly: true },
      );

      const slug = detailUrl.split('/').filter(Boolean).slice(-1)[0] ?? 'detail';
      await writeCache(`m9-1b-stadtgarten-cache/details/${slug}.html`, detailResult.html);

      const evidence = this.parseDetailPage(
        detailResult.html,
        detailResult.finalUrl,
        fetchedAt,
        counters,
        listEntry,
      );

      if (evidence.enrichmentGaps.includes('outside_scope_skipped')) {
        return null;
      }

      if (evidence.startsAt && Date.parse(evidence.startsAt) < nowMs) {
        evidence.enrichmentGaps = [...new Set([...evidence.enrichmentGaps, 'past_event_skipped'])];
      }

      return buildConsumerPreview(evidence, counters);
    });

    const includedPreviews = previews.filter(
      (preview): preview is OfficialEventConsumerPreview =>
        preview !== null && !preview.enrichmentGaps.includes('past_event_skipped'),
    );

    return {
      fetchedAt,
      listUrl: STADTGARTEN_LIST_URL,
      discoveredDetailUrls: uniqueUrls,
      loadedDetailUrls: [...fetchedUrlSet],
      previews: includedPreviews,
      counters,
      mediaCounters: createEmptyMediaPassCounters(),
    };
  }
}
