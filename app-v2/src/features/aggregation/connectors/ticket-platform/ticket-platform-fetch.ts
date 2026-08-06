import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';
import { resolveSourcePublishBehavior } from '@/features/import/domain/publish-behavior';

import { getTicketPlatformAdapter } from './adapter-registry';
import { parseTicketIoShopHtml } from './adapters/ticket-io-adapter';
import { parseTicketKingsShopHtml } from './adapters/ticket-kings-adapter';
import { extractNativeEventCheckoutUrl } from './ticket-kings-public-checkout';
import { TicketIoRequestRateLimiter } from './ticket-io-rate-limit';
import { TICKET_IO_CONNECTOR_VERSION } from '@/features/sources/production/ticket-io-source.core';
import { toNormalizedTicketFields } from './normalize-ticket-event';
import { resolveTicketShopBaseUrl } from './normalize-ticket-event';
import { TICKET_IO_DATA_QUALITY_REPAIR_VERSION } from './ticket-io-repair';
import { extractTicketIoEventSlug } from './ticket-io-url';
import { fetchTicketIoDetailPagesWithAudit, type TicketIoDetailFetchStats } from './ticket-io-detail-fetch';
import { withTicketIoEffectiveLimits } from './ticket-io-effective-config';
import { buildTicketPlatformEvidenceMetadata } from './ticket-platform-evidence-metadata';
import { classifyExternalLineupBlocker } from '@/features/events/domain/external-lineup-blocker-classification';
import type { TicketPlatformSourceConfig } from './types';
import { inferSourceCategory } from '@/features/sources/domain/source-categories';
import type { SourceType } from '@/features/sources/domain/source-types';

const DEFAULT_USER_AGENT =
  'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)';

const PAGINATION_HINT_PATTERN =
  /rel=["']next["']|pagination|data-page|load\s*more|show\s*more/i;

function readTicketPlatformConfig(
  importSource: ImportSource,
): TicketPlatformSourceConfig {
  const config = importSource.sourceConfig?.ticketPlatform;
  if (!config?.platform || !config.shopSlug) {
    throw new Error(
      'Ticket platform source requires sourceConfig.ticketPlatform.platform and shopSlug.',
    );
  }
  return withTicketIoEffectiveLimits(config);
}

async function fetchShopHtml(
  url: string,
  userAgent: string,
  rateLimiter: TicketIoRequestRateLimiter,
): Promise<string> {
  await rateLimiter.waitForSlot();
  const response = await defaultHttpClient.fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Ticket shop fetch failed (${response.status}) for ${url}`);
  }

  return response.text();
}

function detectPaginationHints(html: string): boolean {
  return PAGINATION_HINT_PATTERN.test(html);
}

async function fetchTicketKingsDetailPages(
  listHtml: string,
  config: TicketPlatformSourceConfig,
  userAgent: string,
  rateLimiter: TicketIoRequestRateLimiter,
): Promise<{ detailHtmlByUrl: Record<string, string>; checkoutHtmlByUrl: Record<string, string> }> {
  const maxDetailPages = config.limits?.maxDetailPages ?? 0;
  if (maxDetailPages <= 0 || config.platform !== 'ticket_king') {
    return { detailHtmlByUrl: {}, checkoutHtmlByUrl: {} };
  }

  const eventUrls = new Set<string>();
  let match: RegExpExecArray | null;
  const pattern = /href="(https:\/\/ticketkings\.de\/event\/[^"]+)"/gi;
  while ((match = pattern.exec(listHtml)) !== null) {
    if (match[1]) {
      eventUrls.add(match[1].replace(/\/?$/, '/'));
    }
  }

  const detailHtmlByUrl: Record<string, string> = {};
  const checkoutHtmlByUrl: Record<string, string> = {};
  let fetched = 0;

  for (const eventUrl of eventUrls) {
    if (fetched >= maxDetailPages) {
      break;
    }
    try {
      const html = await fetchShopHtml(eventUrl, userAgent, rateLimiter);
      detailHtmlByUrl[eventUrl] = html;
      const checkoutUrl = extractNativeEventCheckoutUrl(html);
      if (checkoutUrl) {
        try {
          checkoutHtmlByUrl[eventUrl] = await fetchShopHtml(checkoutUrl, userAgent, rateLimiter);
        } catch {
          // Checkout enrichment is best-effort.
        }
      }
      fetched += 1;
    } catch {
      // Detail enrichment is best-effort.
    }
  }

  return { detailHtmlByUrl, checkoutHtmlByUrl };
}

export async function fetchTicketPlatformEvents(input: {
  source: AggregationSource;
  importSource: ImportSource;
  connectorKey: string;
  fixtureHtml?: string;
  fixtureDetailHtmlBySlug?: Record<string, string>;
  fixtureDetailHtmlByUrl?: Record<string, string>;
  fixtureCheckoutHtmlByUrl?: Record<string, string>;
  observedAt?: string;
}): Promise<RawImportedEvent[]> {
  const config = readTicketPlatformConfig(input.importSource);
  const adapter = getTicketPlatformAdapter(config.platform);
  const userAgent = config.userAgent ?? DEFAULT_USER_AGENT;
  const listUrl = config.listUrl ?? resolveTicketShopBaseUrl(config.shopSlug);
  const rateLimiter = TicketIoRequestRateLimiter.fromRequestsPerMinute(
    config.limits?.requestsPerMinute,
  );
  const observedAt = input.observedAt ?? new Date().toISOString();

  const html =
    input.fixtureHtml ??
    input.importSource.sourceConfig?.reference?.html ??
    (await fetchShopHtml(listUrl, userAgent, rateLimiter));

  const usingFixtureList = Boolean(
    input.fixtureHtml ?? input.importSource.sourceConfig?.reference?.html,
  );

  let detailHtmlBySlug: Record<string, string> = input.fixtureDetailHtmlBySlug ?? {};
  let ticketIoDetailFetchStats: TicketIoDetailFetchStats = {
    detailUrlsDiscovered: 0,
    detailUrlsAttempted: 0,
    detailUrlsFetched: 0,
    detailUrlsPowBlocked: 0,
    detailFetchErrors: 0,
    maxDetailPages: config.limits?.maxDetailPages ?? 0,
    skippedReason: usingFixtureList ? ('fixture_mode' as const) : undefined,
  };

  if (config.platform === 'ticket_io' && !usingFixtureList && !input.fixtureDetailHtmlBySlug) {
    const detailResult = await fetchTicketIoDetailPagesWithAudit({
      listHtml: html,
      config,
      userAgent,
      rateLimiter,
      fetchHtml: (url) => fetchShopHtml(url, userAgent, rateLimiter),
    });
    detailHtmlBySlug = detailResult.detailHtmlBySlug;
    ticketIoDetailFetchStats = detailResult.stats;
  }

  const ticketKingsDetail =
    config.platform === 'ticket_king' && !usingFixtureList
      ? await fetchTicketKingsDetailPages(html, config, userAgent, rateLimiter)
      : {
          detailHtmlByUrl: input.fixtureDetailHtmlByUrl ?? ({} as Record<string, string>),
          checkoutHtmlByUrl: input.fixtureCheckoutHtmlByUrl ?? ({} as Record<string, string>),
        };
  const detailHtmlByUrl = ticketKingsDetail.detailHtmlByUrl;
  const checkoutHtmlByUrl = ticketKingsDetail.checkoutHtmlByUrl;

  const { events, scopeStats } =
    config.platform === 'ticket_io'
      ? parseTicketIoShopHtml(html, config, detailHtmlBySlug)
      : config.platform === 'ticket_king'
        ? parseTicketKingsShopHtml(html, config, detailHtmlByUrl, checkoutHtmlByUrl)
        : adapter.parseShopHtml(html, config);
  const publishBehavior = resolveSourcePublishBehavior({
    sourceType: input.importSource.type as SourceType,
    publishMode: input.importSource.sourceConfig?.publishPolicy?.mode ?? 'manual_review',
    sourceConfig: input.importSource.sourceConfig,
    sourceRoles: input.importSource.sourceRoles,
    category: inferSourceCategory({ sourceType: input.importSource.type as SourceType }),
  });
  const isEnrichment = publishBehavior === 'enrichment';
  const pagesProcessed =
    1 +
    Object.keys(detailHtmlBySlug).length +
    Object.keys(detailHtmlByUrl).length;
  const paginationDetected = detectPaginationHints(html);
  const shopDetailPagesFetched =
    Object.keys(detailHtmlBySlug).length + Object.keys(detailHtmlByUrl).length;
  const detailPagesBlocked =
    (config.platform === 'ticket_io' &&
      (config.limits?.maxDetailPages ?? 0) > 0 &&
      shopDetailPagesFetched === 0 &&
      ticketIoDetailFetchStats.detailUrlsDiscovered > 0) ||
    (config.platform === 'ticket_king' &&
      (config.limits?.maxDetailPages ?? 0) > 0 &&
      Object.keys(detailHtmlByUrl).length === 0);

  return events.map((event) => {
    const normalized = toNormalizedTicketFields(event);
    const eventSlug =
      event.eventSlug ??
      extractTicketIoEventSlug(normalized.ticketUrl) ??
      extractTicketIoEventSlug(normalized.eventUrl);
    const eventDetailFetched = Boolean(eventSlug && detailHtmlBySlug[eventSlug]);
    const detailHtml =
      config.platform === 'ticket_io'
        ? eventSlug
          ? detailHtmlBySlug[eventSlug]
          : undefined
        : detailHtmlByUrl[event.eventUrl] ?? detailHtmlByUrl[normalized.eventUrl];
    const checkoutUrl =
      config.platform === 'ticket_king' && detailHtml
        ? extractNativeEventCheckoutUrl(detailHtml)
        : undefined;
    const evidenceMetadata = buildTicketPlatformEvidenceMetadata({
      event,
      connectorKey: input.connectorKey,
      platform: config.platform,
      shopSlug: config.shopSlug,
      enrichmentSource: isEnrichment,
      observedAt,
      verifiedAt: observedAt,
      detailHtml,
      checkoutUrl,
      listRowTitle: !detailHtml && event.title ? event.title : undefined,
      scopeStats: scopeStats as unknown as Record<string, unknown>,
    });
    return {
      externalId: normalized.externalId,
      importId: normalized.externalId,
      sourceUrl: normalized.eventUrl,
      originalLink: normalized.eventUrl,
      title: normalized.title,
      description: normalized.description,
      startDate: normalized.startDate,
      endDate: normalized.endDate,
      timezone: normalized.timezone,
      venueName: normalized.venueName,
      venueAddress: normalized.venueAddress,
      cityName: normalized.cityName,
      countryCode: normalized.countryCode,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      artistNames: normalized.artistNames,
      genreNames: normalized.genreNames,
      organizerName: normalized.organizerName,
      ticketUrl: normalized.ticketUrl,
      eventUrl: normalized.eventUrl,
      imageUrl: normalized.imageUrl,
      priceAmount: normalized.priceAmount,
      priceCurrency: normalized.priceCurrency,
      priceText: event.priceText,
      cancelled: normalized.cancelled,
      rawSourceType: 'json_ld',
      sourceMetadata: {
        ...evidenceMetadata,
        normalizedHash: normalized.normalizedHash,
        availability: normalized.availability,
        soldOut: event.soldOut,
        priceText: event.priceText,
        eventSlug: event.eventSlug ?? extractTicketIoEventSlug(normalized.ticketUrl),
        lineupEntries: event.lineupEntries,
        ticketOffers: event.ticketOffers,
        genreNames: event.genreNames,
        eventAttributes: event.eventAttributes,
        floorCount: event.floorCount,
        minimumAge: event.minimumAge,
        doorsOpenAt: event.doorsOpenAt,
        venueEnvironment: event.venueEnvironment,
        electronicRelevance: event.electronicRelevance,
        scopeStats,
        connectorVersion: TICKET_IO_CONNECTOR_VERSION,
        dataQualityRepairVersion: TICKET_IO_DATA_QUALITY_REPAIR_VERSION,
        detailEnrichment: {
          pagesFetched: eventDetailFetched ? 1 : 0,
          detailFetched: eventDetailFetched,
          shopPagesFetched: shopDetailPagesFetched,
          ...ticketIoDetailFetchStats,
          blockedByPow: detailPagesBlocked,
          parserInvoked: eventDetailFetched,
          lineupBlockerClass: classifyExternalLineupBlocker({
            metadata: {
              detailEnrichment: {
                blockedByPow: detailPagesBlocked,
                detailUrlsAttempted: ticketIoDetailFetchStats.detailUrlsAttempted,
                detailUrlsFetched: ticketIoDetailFetchStats.detailUrlsFetched,
              },
            },
            hasRawLineup: Boolean(event.artistNames?.length || event.lineupEntries?.length),
            flyerEvidencePresent: false,
          }),
        },
        syncRun: {
          pagesProcessed,
          paginationDetected,
        },
        ...(event.checkoutProviderId
          ? { checkoutProviderId: event.checkoutProviderId }
          : {}),
      },
    };
  });
}
