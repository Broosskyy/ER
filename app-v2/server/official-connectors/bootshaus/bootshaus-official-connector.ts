import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  buildImageHostAllowlist,
  createEmptyMediaPassCounters,
  enrichOfficialEvidenceWithMedia,
  terminateSharedTesseractWorker,
} from '../media-evidence';
import { buildConsumerPreview } from '../preview';
import { safeFetchHtml } from '../safe-fetch';
import {
  createEmptyConnectorCounters,
  type ConnectorErrorCounters,
  type OfficialEventConsumerPreview,
} from '../types';
import { BOOTSHAUS_LIST_URL } from './constants';
import { buildBootshausMediaEvidenceContext } from './build-bootshaus-media-evidence';
import { parseBootshausDetailPage } from './parse-detail';
import { dedupeDetailUrls, extractBootshausDetailUrlsFromListHtml } from './parse-list';

const MAX_DETAIL_PAGES = 40;
const DETAIL_CONCURRENCY = 3;

export interface BootshausConnectorRunOptions {
  now?: () => Date;
  maxDetailPages?: number;
  writeCache?: (relativePath: string, contents: string) => Promise<void>;
}

export interface BootshausConnectorRunResult {
  fetchedAt: string;
  listUrl: string;
  discoveredDetailUrls: string[];
  loadedDetailUrls: string[];
  previews: OfficialEventConsumerPreview[];
  counters: ConnectorErrorCounters;
  mediaCounters: ReturnType<typeof createEmptyMediaPassCounters>;
}

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

export class BootshausOfficialConnector {
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

    const listResult = await safeFetchHtml(BOOTSHAUS_LIST_URL, {
      counters,
      allowListOnly: true,
    });
    await writeCache('m3-bootshaus-cache/list.html', listResult.html);

    const discovered = extractBootshausDetailUrlsFromListHtml(listResult.html);
    const { uniqueUrls, duplicateCount } = dedupeDetailUrls(discovered);
    counters.duplicateListEntries += duplicateCount;

    const nowMs = Date.parse(fetchedAt);
    const detailUrls = uniqueUrls.slice(0, options.maxDetailPages ?? MAX_DETAIL_PAGES);
    const fetchedUrlSet = new Set<string>();

    const previews = await mapWithConcurrency(detailUrls, DETAIL_CONCURRENCY, async (detailUrl) => {
      if (fetchedUrlSet.has(detailUrl)) {
        counters.duplicateDetailFetches += 1;
        throw new Error(`Duplicate detail fetch attempted for ${detailUrl}`);
      }
      fetchedUrlSet.add(detailUrl);

      const detailResult = await safeFetchHtml(detailUrl, {
        counters,
        allowDetailOnly: true,
      });

      const slug = new URL(detailResult.finalUrl).pathname.split('/').filter(Boolean)[1] ?? 'unknown';
      await writeCache(`m3-bootshaus-cache/details/${slug}.html`, detailResult.html);

      const textEvidence = parseBootshausDetailPage(
        detailResult.html,
        detailResult.finalUrl,
        fetchedAt,
        counters,
      );

      if (textEvidence.startsAt && Date.parse(textEvidence.startsAt) < nowMs) {
        textEvidence.enrichmentGaps = [...new Set([...textEvidence.enrichmentGaps, 'past_event_skipped'])];
      }

      let evidence = textEvidence;
      if (textEvidence.officialImageUrl && !textEvidence.enrichmentGaps.includes('past_event_skipped')) {
        for (const host of buildImageHostAllowlist([textEvidence.officialImageUrl])) {
          allowedImageHosts.add(host);
        }
        evidence = await enrichOfficialEvidenceWithMedia(textEvidence, {
          counters,
          mediaCounters,
          allowedImageHosts,
          sourceObservedAt: fetchedAt,
          mediaContext: buildBootshausMediaEvidenceContext(textEvidence),
        });
      }

      return buildConsumerPreview(evidence, counters);
    });

    await terminateSharedTesseractWorker();

    const futurePreviews = previews.filter(
      (preview) => !preview.enrichmentGaps.includes('past_event_skipped'),
    );

    return {
      fetchedAt,
      listUrl: BOOTSHAUS_LIST_URL,
      discoveredDetailUrls: uniqueUrls,
      loadedDetailUrls: [...fetchedUrlSet],
      previews: futurePreviews,
      counters,
      mediaCounters,
    };
  }
}
