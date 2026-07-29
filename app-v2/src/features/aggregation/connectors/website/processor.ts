import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import { resolveWebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import { detectWebsiteDocument } from '@/features/aggregation/connectors/website/detection';
import { websiteFetchLayer } from '@/features/aggregation/connectors/website/fetch';
import { mapRawWebsiteEvents } from '@/features/aggregation/connectors/website/mapper';
import {
  createPaginationState,
  markPaginationVisit,
  resolveNextPageUrl,
  shouldStopPagination,
} from '@/features/aggregation/connectors/website/pagination';
import { resolveWebsiteRunLimits } from '@/features/aggregation/connectors/website/limits';
import { isAllowedDomain } from '@/features/aggregation/connectors/website/security';
import { selectWebsiteStrategy } from '@/features/aggregation/connectors/website/strategy-selector';
import type {
  WebsiteDetectionReport,
  WebsiteExtractionResult,
  WebsiteDocument,
} from '@/features/aggregation/connectors/website/types';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { ImportSource } from '@/features/import/models/types';

export interface WebsiteProcessorInput {
  url: string;
  importSource: ImportSource;
  connectorKey: string;
  htmlOverride?: string;
}

export interface WebsiteProcessorOutput {
  events: RawImportedEvent[];
  result: WebsiteExtractionResult;
}

export class WebsiteProcessor {
  async detect(input: WebsiteProcessorInput): Promise<WebsiteDetectionReport> {
    const config = resolveWebsiteConnectorConfig(input.importSource.sourceConfig);
    const document = await websiteFetchLayer.fetchDocument({
      url: input.url,
      config,
      limits: resolveWebsiteRunLimits(config.limits),
      htmlOverride: input.htmlOverride ?? input.importSource.sourceConfig?.reference?.html,
    });
    return detectWebsiteDocument(document, config);
  }

  async process(input: WebsiteProcessorInput): Promise<WebsiteProcessorOutput> {
    const config = resolveWebsiteConnectorConfig(input.importSource.sourceConfig);
    const limits = resolveWebsiteRunLimits(config.limits);
    const fetchStartedAt = Date.now();

    let document = await websiteFetchLayer.fetchDocument({
      url: input.url,
      config,
      limits,
      htmlOverride: input.htmlOverride ?? input.importSource.sourceConfig?.reference?.html,
    });

    const detectionStartedAt = Date.now();
    const detection = detectWebsiteDocument(document, config);
    const strategy = selectWebsiteStrategy(document, config);
    const validation = strategy.validateConfiguration(config);
    if (!validation.valid) {
      return {
        events: [],
        result: {
          events: [],
          detection,
          diagnostics: {
            fetchDurationMs: detectionStartedAt - fetchStartedAt,
            responseSize: document.responseSize,
            redirectCount: document.redirectChain.length,
            detectionDurationMs: Date.now() - detectionStartedAt,
            extractionDurationMs: 0,
            strategy: strategy.key,
            confidence: 0,
            candidateCount: 0,
            validEventCount: 0,
            skippedCount: 0,
            detailPagesFetched: 0,
            paginationPagesFetched: 0,
            warnings: validation.issues.map((issue) => issue.message),
          },
        },
      };
    }

    const paginationState = createPaginationState();
    markPaginationVisit(paginationState, document.finalUrl);
    const allEvents: import('@/features/aggregation/connectors/website/types').RawWebsiteEvent[] = [];
    let detailPagesFetched = 0;
    let previousHash: string | undefined;

    const fetchDetailPage = async (detailUrl: string): Promise<WebsiteDocument> => {
      if (detailPagesFetched >= limits.maxDetailPages) {
        throw new Error('Maximum detail pages exceeded.');
      }
      if (!isAllowedDomain(detailUrl, config.eventDetailPage?.allowedDomains)) {
        throw new Error('Detail page domain is not allowed.');
      }
      detailPagesFetched += 1;
      return websiteFetchLayer.fetchDocument({ url: detailUrl, config, limits });
    };

    const extractionStartedAt = Date.now();
    while (true) {
      const extraction = await strategy.extract(document, config, {
        baseUrl: input.url,
        connectorKey: input.connectorKey,
        fetchDetailPage,
      });
      allEvents.push(...extraction.events);

      const nextUrl = resolveNextPageUrl(document, config);
      const contentHash = String(document.html.length);
      if (
        shouldStopPagination(
          paginationState,
          limits,
          nextUrl,
          extraction.events.length > 0,
          contentHash,
          previousHash,
        )
      ) {
        break;
      }
      previousHash = contentHash;
      document = await websiteFetchLayer.fetchDocument({ url: nextUrl!, config, limits });
      markPaginationVisit(paginationState, document.finalUrl);
    }

    const limitedEvents = allEvents.slice(0, limits.maxEventsPerRun);
    const extractionDurationMs = Date.now() - extractionStartedAt;

    const result: WebsiteExtractionResult = {
      events: limitedEvents,
      detection,
      diagnostics: {
        fetchDurationMs: detectionStartedAt - fetchStartedAt,
        responseSize: document.responseSize,
        redirectCount: document.redirectChain.length,
        detectionDurationMs: extractionStartedAt - detectionStartedAt,
        extractionDurationMs,
        strategy: strategy.key,
        confidence: detection.detectedStrategies.find((entry) => entry.key === strategy.key)?.confidence ?? 0,
        candidateCount: allEvents.length,
        validEventCount: limitedEvents.length,
        skippedCount: allEvents.length - limitedEvents.length,
        detailPagesFetched,
        paginationPagesFetched: paginationState.pagesFetched,
        warnings: detection.warnings,
      },
    };

    return {
      events: mapRawWebsiteEvents(limitedEvents, input.connectorKey, config.transforms),
      result,
    };
  }
}

export const websiteProcessor = new WebsiteProcessor();
