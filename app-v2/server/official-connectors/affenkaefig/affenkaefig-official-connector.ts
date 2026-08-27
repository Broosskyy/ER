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
import {
  buildImageHostAllowlist,
  createEmptyMediaPassCounters,
  enrichOfficialEvidenceWithMedia,
  terminateSharedTesseractWorker,
} from '../media-evidence';
import { buildConsumerPreview } from '../preview';
import {
  processOfficialEventTickets,
  resetTicketFetchCache,
} from '../ticket-evidence/ticket-evidence-pipeline';
import { reconcileVerifiedTicketSupplementalEvidence } from '../ticket-evidence/reconcile-verified-ticket-supplemental';
import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';
import {
  createEmptyConnectorCounters,
  type ConnectorErrorCounters,
  type OfficialEventConsumerPreview,
  type OfficialEventEvidence,
} from '../types';
import {
  AFFENKAEFIG_CONNECTOR_ID,
  AFFENKAEFIG_LIST_URL,
} from './constants';
import { affenkaefigSafeFetchPolicy } from './fetch-policy';
import { buildAffenkaefigMediaEvidenceContext } from './build-affenkaefig-media-evidence';
import { parseAffenkaefigDetailPage } from './parse-detail';
import {
  dedupeAffenkaefigDetailUrls,
  extractAffenkaefigDetailUrlsFromListHtml,
} from './parse-list';

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

export class AffenkaefigOfficialConnector implements OfficialConnector {
  readonly metadata: OfficialConnectorMetadata = {
    connectorId: AFFENKAEFIG_CONNECTOR_ID,
    sourceType: 'organizer',
    displayName: 'Affenkäfig Official',
    defaultListUrl: AFFENKAEFIG_LIST_URL,
    capabilities: {
      listDiscovery: true,
      detailFetch: true,
      mediaEnrichment: true,
    },
  };

  discoverFromListHtml(listHtml: string, listUrl: string): OfficialConnectorDiscoveryResult {
    const discovered = extractAffenkaefigDetailUrlsFromListHtml(listHtml);
    const { uniqueUrls, duplicateCount } = dedupeAffenkaefigDetailUrls(discovered);
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
    const result = await safeFetchHtmlWithPolicy(url, affenkaefigSafeFetchPolicy, options, context);
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
    return parseAffenkaefigDetailPage(html, finalUrl, fetchedAt, counters);
  }

  async runPreview(options: OfficialConnectorRunOptions = {}): Promise<OfficialConnectorRunResult> {
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
      AFFENKAEFIG_LIST_URL,
      { counters },
      { allowListOnly: true },
    );
    await writeCache('m8-6-affenkaefig-cache/list.html', listResult.html);

    const discovery = this.discoverFromListHtml(listResult.html, AFFENKAEFIG_LIST_URL);
    counters.duplicateListEntries += discovery.duplicateCount;

    const nowMs = Date.parse(fetchedAt);
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

      const slug = new URL(detailResult.finalUrl).pathname.split('/').filter(Boolean).pop() ?? 'unknown';
      await writeCache(`m8-6-affenkaefig-cache/details/${slug}.html`, detailResult.html);

      const evidence = this.parseDetailPage(
        detailResult.html,
        detailResult.finalUrl,
        fetchedAt,
        counters,
      );

      if (evidence.startsAt && Date.parse(evidence.startsAt) < nowMs) {
        evidence.enrichmentGaps = [...new Set([...evidence.enrichmentGaps, 'past_event_skipped'])];
      }

      let enrichedEvidence = evidence;
      if (
        evidence.officialImageUrl &&
        !evidence.enrichmentGaps.includes('past_event_skipped')
      ) {
        for (const host of buildImageHostAllowlist([evidence.officialImageUrl])) {
          allowedImageHosts.add(host);
        }
        enrichedEvidence = await enrichOfficialEvidenceWithMedia(evidence, {
          counters,
          mediaCounters,
          allowedImageHosts,
          sourceObservedAt: fetchedAt,
          mediaContext: buildAffenkaefigMediaEvidenceContext(evidence),
        });
      }

      const ticketResult = await processOfficialEventTickets(
        {
          sourceEventKey: enrichedEvidence.sourceEventKey,
          officialUrl: enrichedEvidence.officialUrl,
          title: enrichedEvidence.title,
          startsAt: enrichedEvidence.startsAt,
          endsAt: enrichedEvidence.endsAt,
          venueName: enrichedEvidence.venue?.name,
          organizerName: enrichedEvidence.organizerLabel,
        },
        {
          prefetchedHtml: detailResult.html,
          observedAt: fetchedAt,
        },
      );
      ticketResults.push(ticketResult);

      const withSupplemental = reconcileVerifiedTicketSupplementalEvidence(enrichedEvidence, ticketResult);

      return buildConsumerPreview(withSupplemental, counters);
    });

    await terminateSharedTesseractWorker();

    const futurePreviews = previews.filter(
      (preview) => !preview.enrichmentGaps.includes('past_event_skipped'),
    );

    return {
      fetchedAt,
      listUrl: AFFENKAEFIG_LIST_URL,
      discoveredDetailUrls: discovery.detailUrls,
      loadedDetailUrls: [...fetchedUrlSet],
      previews: futurePreviews,
      counters,
      mediaCounters,
      ticketResults,
    };
  }
}
