import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import type { WebsiteRunLimits } from '@/features/aggregation/connectors/website/limits';
import { resolveRelativeUrl } from '@/features/aggregation/connectors/website/security';
import type { RawWebsiteEvent, WebsiteDocument } from '@/features/aggregation/connectors/website/types';
import { extractDetailPageEventWithStrategy } from '@/features/aggregation/connectors/website/html-strategies';
import type { WebsiteStrategyContext } from '@/features/aggregation/connectors/website/strategy-types';
import {
  mergeListDetailFields,
  type DetailEnrichmentDiagnostics,
} from '@/features/aggregation/connectors/framework/detail-extraction/detail-extraction-lifecycle';
import { enrichWebsiteEventFromTextualSources } from '@/features/aggregation/connectors/website/website-textual-enrichment';
import {
  maybeRunIntegratedShadowExtraction,
  type IntegratedShadowConfigOverrides,
} from '@/features/import/shadow/unified-website-integrated-shadow';

export interface WebsiteListDetailEnrichmentResult {
  events: RawWebsiteEvent[];
  diagnostics: DetailEnrichmentDiagnostics;
}

export interface WebsiteListDetailEnrichmentInput {
  events: RawWebsiteEvent[];
  config: WebsiteConnectorConfig;
  limits: WebsiteRunLimits;
  baseUrl: string;
  connectorKey: string;
  fetchDetailPage: (detailUrl: string) => Promise<WebsiteDocument>;
  detailPagesAlreadyFetched?: number;
  integratedShadow?: {
    sourceId: string;
    sourceName: string;
    configOverrides?: IntegratedShadowConfigOverrides;
  };
}

const DEFAULT_DETAIL_FETCH_CONCURRENCY = 3;

function resolveDetailUrl(listEvent: RawWebsiteEvent, baseUrl: string): string | undefined {
  if (listEvent.detailUrl) {
    return listEvent.detailUrl;
  }
  if (listEvent.externalId.startsWith('http')) {
    return listEvent.externalId;
  }
  return resolveRelativeUrl(baseUrl, listEvent.externalId) ?? undefined;
}

function applyMergedFields(listEvent: RawWebsiteEvent, merged: ReturnType<typeof mergeListDetailFields>['merged']): RawWebsiteEvent {
  return enrichWebsiteEventFromTextualSources({
    ...listEvent,
    rawDescription: merged.description ?? listEvent.rawDescription,
    rawArtists: merged.artists ?? listEvent.rawArtists,
    rawGenres: merged.genres ?? listEvent.rawGenres,
    rawImages: merged.images ?? listEvent.rawImages,
    rawTicketLinks: merged.ticketLinks ?? listEvent.rawTicketLinks,
    rawOrganizer: merged.organizer ?? listEvent.rawOrganizer,
    rawVenue: merged.venue ?? listEvent.rawVenue,
    extractionStrategy: listEvent.extractionStrategy,
    warnings: [
      ...listEvent.warnings,
      ...(merged.description ? ['detail_enrichment_applied'] : []),
    ],
  });
}

function withOfficialDetailHtml(event: RawWebsiteEvent, detailHtml: string): RawWebsiteEvent {
  return {
    ...event,
    officialDetailHtml: detailHtml,
  };
}

export async function enrichWebsiteListEventsWithDetailPages(
  input: WebsiteListDetailEnrichmentInput,
): Promise<WebsiteListDetailEnrichmentResult> {
  const maxDetailPages = input.limits.maxDetailPages;
  if (maxDetailPages <= 0) {
    return {
      events: input.events,
      diagnostics: { attempted: 0, enriched: 0, skipped: input.events.length, failed: 0, blocked: 0 },
    };
  }

  const context: WebsiteStrategyContext = {
    baseUrl: input.baseUrl,
    connectorKey: input.connectorKey,
  };

  const diagnostics: DetailEnrichmentDiagnostics = {
    attempted: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    blocked: 0,
  };

  let detailPagesFetched = input.detailPagesAlreadyFetched ?? 0;
  const enrichedEvents: RawWebsiteEvent[] = new Array(input.events.length);
  let nextIndex = 0;
  const concurrency = Math.min(
    DEFAULT_DETAIL_FETCH_CONCURRENCY,
    Math.max(1, input.events.length),
  );

  const enrichOne = async (listEvent: RawWebsiteEvent, eventIndex: number): Promise<void> => {
    const detailUrl = resolveDetailUrl(listEvent, input.baseUrl);
    if (!detailUrl) {
      diagnostics.skipped += 1;
      enrichedEvents[eventIndex] = listEvent;
      return;
    }
    if (detailPagesFetched >= maxDetailPages) {
      diagnostics.blocked += 1;
      enrichedEvents[eventIndex] = listEvent;
      return;
    }

    diagnostics.attempted += 1;
    try {
      const detailDocument = await input.fetchDetailPage(detailUrl);
      detailPagesFetched += 1;

      if (input.integratedShadow) {
        maybeRunIntegratedShadowExtraction({
          sourceId: input.integratedShadow.sourceId,
          sourceName: input.integratedShadow.sourceName,
          detailUrl,
          html: detailDocument.html,
          finalUrl: detailDocument.finalUrl,
          httpStatus: detailDocument.statusCode,
          legacyEvent: listEvent,
          configOverrides: input.integratedShadow.configOverrides,
        });
      }

      const detailEvent = await extractDetailPageEventWithStrategy(detailDocument, input.config, context);
      if (!detailEvent) {
        diagnostics.failed += 1;
        enrichedEvents[eventIndex] = withOfficialDetailHtml(listEvent, detailDocument.html);
        return;
      }

      const { merged } = mergeListDetailFields(
        {
          externalId: listEvent.externalId,
          description: listEvent.rawDescription,
          artists: listEvent.rawArtists,
          genres: listEvent.rawGenres,
          images: listEvent.rawImages,
          ticketLinks: listEvent.rawTicketLinks,
          organizer: listEvent.rawOrganizer,
          venue: listEvent.rawVenue,
        },
        {
          externalId: detailEvent.externalId,
          description: detailEvent.rawDescription,
          artists: detailEvent.rawArtists,
          genres: detailEvent.rawGenres,
          images: detailEvent.rawImages,
          ticketLinks: detailEvent.rawTicketLinks,
          organizer: detailEvent.rawOrganizer,
          venue: detailEvent.rawVenue,
        },
      );

      if (merged.description || merged.artists?.length || merged.genres?.length) {
        diagnostics.enriched += 1;
        enrichedEvents[eventIndex] = withOfficialDetailHtml(applyMergedFields(listEvent, merged), detailDocument.html);
      } else {
        diagnostics.skipped += 1;
        enrichedEvents[eventIndex] = withOfficialDetailHtml(listEvent, detailDocument.html);
      }
    } catch {
      diagnostics.failed += 1;
      enrichedEvents[eventIndex] = listEvent;
    }
  };

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const eventIndex = nextIndex;
        nextIndex += 1;
        if (eventIndex >= input.events.length) {
          return;
        }
        await enrichOne(input.events[eventIndex]!, eventIndex);
      }
    }),
  );

  return { events: enrichedEvents, diagnostics };
}
