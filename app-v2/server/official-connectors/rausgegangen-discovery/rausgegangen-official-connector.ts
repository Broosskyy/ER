import type {
  OfficialConnector,
  OfficialConnectorDiscoveryResult,
  OfficialConnectorFetchResult,
  OfficialConnectorMetadata,
  OfficialConnectorRunOptions,
  OfficialConnectorRunResult,
} from '../connector-contract';
import { createEmptyMediaPassCounters } from '../media-evidence';
import {isNonPerformanceEventFormat} from './format-exclusions';
import { buildConsumerPreview } from '../preview';
import { createPlaywrightTicketBrowserOps } from '../ticket-evidence/create-playwright-ticket-browser-ops';
import type { DetailFetchResult } from '../ticket-evidence/network-discovery/detail-fetch';
import {
  resetTicketFetchCache,
} from '../ticket-evidence/ticket-evidence-pipeline';
import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';
import {
  createEmptyConnectorCounters,
  type ConnectorErrorCounters,
  type OfficialEventEvidence,
} from '../types';
import type { SafeFetchRequestContext, SafeFetchRequestOptions } from '../generic-safe-fetch';

import {
  RAUSGEGANGEN_BASE_URL,
  RAUSGEGANGEN_DISCOVERY_CONNECTOR_ID,
} from './constants';
import {
  buildOfficialEvidenceFromRausgegangenEnriched,
  finalizeRausgegangenControlledImportEvidence,
} from './rausgegangen-controlled-import-bridge';
import {
  applyDetailToCandidate,
  enrichedFromRausgegangenCandidate,
  listingEntryToCandidate,
} from './rausgegangen-enrichment';
import { fetchRausgegangenHtml, type FetchResult } from './rausgegangen-fetch';
import { runRausgegangenNetworkDiscovery } from './rausgegangen-network-discovery';
import { parseRausgegangenEventDetail } from './parse-rausgegangen-detail';
import {
  dedupeListingEntries,
  parseRausgegangenCityListing,
} from './parse-rausgegangen-listing';
import {
  extractEventSlugFromUrl,
  extractRegionSlugFromUrl,
} from './rausgegangen-url';

const MAX_DETAIL_PAGES = 40;

export interface RausgegangenOfficialConnectorOptions {
  regionSlugs?: string[];
  preferredEventUrls?: string[];
  knownEventUrls?: string[];
  selectionSlot?: number;
}

function toDetailFetchResult(
  fetchResult: FetchResult,
  detailAccess: DetailFetchResult['detailAccess'],
): DetailFetchResult {
  return {
    html: fetchResult.html,
    finalUrl: fetchResult.finalUrl,
    fetchStatus: fetchResult.status,
    fetchMethod: 'fetch',
    detailAccess,
    blocked: fetchResult.status === 403,
    contentFingerprint: undefined,
  };
}

export class RausgegangenOfficialConnector implements OfficialConnector {
  readonly metadata: OfficialConnectorMetadata = {


    connectorId: RAUSGEGANGEN_DISCOVERY_CONNECTOR_ID,
    sourceType: 'event_platform',
    displayName: 'Rausgegangen Discovery',
    defaultListUrl: RAUSGEGANGEN_BASE_URL,
    capabilities: {
      listDiscovery: true,
      detailFetch: true,
      mediaEnrichment: true,
    },
  };

  private scheduledApplyEventUrls?: string[];

  constructor(private readonly connectorOptions: RausgegangenOfficialConnectorOptions = {}) {}

  /** Apply ONLY the exact validated key/URL pairs from the preceding dry run.
   * Safe to call only in a dedicated scheduled server worker. */
  setScheduledApplyEventUrls(urls: readonly string[]): void {
    this.scheduledApplyEventUrls = [...urls];
  }

  discoverFromListHtml(
    listHtml: string,
    listUrl: string,
  ): OfficialConnectorDiscoveryResult {
    const regionSlug = extractRegionSlugFromUrl(listUrl) ?? 'cologne';
    const entries = parseRausgegangenCityListing(listHtml, regionSlug, listUrl);
    const deduped = dedupeListingEntries(entries);
    return {
      listUrl,
      detailUrls: deduped.unique.map((entry) => entry.eventUrl),
      duplicateCount: deduped.duplicateCount,
    };
  }

  async fetchHtml(
    url: string,
    _options: SafeFetchRequestOptions,
    _context: SafeFetchRequestContext = {},
  ): Promise<OfficialConnectorFetchResult> {
    const result = await fetchRausgegangenHtml(url);
    if (!result.ok) {
      throw new Error(`rausgegangen_fetch_failed:${result.status}:${result.error ?? 'unknown'}`);
    }
    return {
      finalUrl: result.finalUrl,
      html: result.html,
      contentType: 'text/html',
    };
  }

  parseDetailPage(
    html: string,
    finalUrl: string,
    fetchedAt: string,
    _counters: ConnectorErrorCounters,
  ): OfficialEventEvidence {
    const eventSlug = extractEventSlugFromUrl(finalUrl);
    if (!eventSlug) {
      throw new Error(`rausgegangen_invalid_detail_url:${finalUrl}`);
    }

    const referenceInstant = new Date(fetchedAt);
    const listingEntry = {
      eventUrl: finalUrl,
      eventSlug,
      regionSlug: 'germany',
      listingSurface: RAUSGEGANGEN_BASE_URL,
      listingTitleHint: undefined,
    };
    let candidate = listingEntryToCandidate(listingEntry, referenceInstant);
    const detail = parseRausgegangenEventDetail(html, finalUrl);
    candidate = applyDetailToCandidate(candidate, detail, referenceInstant);
    const enriched = enrichedFromRausgegangenCandidate(candidate, [], referenceInstant);

    return buildOfficialEvidenceFromRausgegangenEnriched(
      enriched,
      toDetailFetchResult(
        {
          ok: true,
          status: 200,
          html,
          finalUrl,
          fromCache: false,
        },
        enriched.detailAccess,
      ),
      fetchedAt,
    );
  }

  async runPreview(
    options: OfficialConnectorRunOptions = {},
  ): Promise<OfficialConnectorRunResult> {
    const counters = createEmptyConnectorCounters();
    const mediaCounters = createEmptyMediaPassCounters();
    const fetchedAt = (options.now?.() ?? new Date()).toISOString();
    const referenceInstant = new Date(fetchedAt);
    const previews: OfficialConnectorRunResult['previews'] = [];
    const ticketResults: VerifiedTicketCompleteResult[] = [];
    const loadedDetailUrls: string[] = [];
    const selectionQuality={pastOrEnded:0,notElectronic:0,notDanceEvent:0,unready:0,accepted:0};
    const browserOps = createPlaywrightTicketBrowserOps({ ticketPageWaitMs: 3_000 });
    resetTicketFetchCache();

    try {
      const exactApplyUrls = this.scheduledApplyEventUrls;
      const discovery = await runRausgegangenNetworkDiscovery({
        referenceInstant,
        regionSlugs: exactApplyUrls ? [] : this.connectorOptions.regionSlugs,
        preferredEventUrls: exactApplyUrls ?? this.connectorOptions.preferredEventUrls,
        preferredOnly: exactApplyUrls !== undefined,
        knownEventUrls: exactApplyUrls ? [] : this.connectorOptions.knownEventUrls,
        selectionSlot: this.connectorOptions.selectionSlot,
        maxDetailCandidates: exactApplyUrls
          ? Math.min(exactApplyUrls.length, options.maxDetailPages ?? MAX_DETAIL_PAGES)
          : options.maxDetailPages ?? MAX_DETAIL_PAGES,
        // Speed up read-only discovery with bounded parallel requests.
        // Provider-specific evidence and DB apply remain serialized.
        detailConcurrency: 2,
        listingConcurrency: 2,
        requestDelayMs: options.requestDelayMs,
        onVerifiedDetail: async ({ enriched, fetchResult }) => {
          if (enriched.lifecycle === 'ENDED') {
            selectionQuality.pastOrEnded++; return;
          }
          if (enriched.relevance === 'IRRELEVANT' ||
              enriched.relevance === 'AMBIGUOUS') {
            selectionQuality.notElectronic++; return;
          }
          if (isNonPerformanceEventFormat(enriched.title, enriched.description ?? '')) {
            selectionQuality.notDanceEvent++; return;
          }

          const finalized = await finalizeRausgegangenControlledImportEvidence(
            enriched,
            toDetailFetchResult(fetchResult, enriched.detailAccess),
            fetchedAt,
            { browserOps },
          );

          if (finalized.evidence.enrichmentGaps.includes('past_event_skipped')) {
            selectionQuality.unready++; return;
          }
          selectionQuality.accepted++;

          previews.push(buildConsumerPreview(finalized.evidence, counters));
          loadedDetailUrls.push(finalized.evidence.officialUrl);
          if (finalized.ticketResult) {
            ticketResults.push(finalized.ticketResult);
          }
        },
      });

      counters.duplicateListEntries += discovery.summary.duplicateListingEntries;

      return {
        fetchedAt,
        listUrl: RAUSGEGANGEN_BASE_URL,
        discoveredDetailUrls: discovery.listingEntries.map((entry) => entry.eventUrl),
        loadedDetailUrls: [...new Set(loadedDetailUrls)],
        previews,
        counters,
        mediaCounters,
        ticketResults,
        sourceQualityAudit:{
          ...selectionQuality,
          fetchedDetailPages:discovery.summary.detailFetched,
          detailSuccess:discovery.accessReliability.detailFetchSuccess,
          detailFailure:discovery.accessReliability.detailFetchFailed,
          // Distinguish dead links (404) from rate limits (429/403) and
          // timeouts before changing discovery strategy or request cadence.
          detailFailureReasons: discovery.accessReliability.detailFailureReasons,
          parseFailures:discovery.accessReliability.parseFailures,
        },
      };
    } finally {
      await browserOps.close();
    }
  }
}
