import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { ImportSource } from '@/features/import/models/types';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';

import { getTicketPlatformAdapter } from './adapter-registry';
import { toNormalizedTicketFields } from './normalize-ticket-event';
import { resolveTicketShopBaseUrl } from './normalize-ticket-event';
import type { TicketPlatformSourceConfig } from './types';

const DEFAULT_USER_AGENT =
  'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)';

function readTicketPlatformConfig(
  importSource: ImportSource,
): TicketPlatformSourceConfig {
  const config = importSource.sourceConfig?.ticketPlatform;
  if (!config?.platform || !config.shopSlug) {
    throw new Error(
      'Ticket platform source requires sourceConfig.ticketPlatform.platform and shopSlug.',
    );
  }
  return config;
}

async function fetchShopHtml(url: string, userAgent: string): Promise<string> {
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

export async function fetchTicketPlatformEvents(input: {
  source: AggregationSource;
  importSource: ImportSource;
  connectorKey: string;
  fixtureHtml?: string;
}): Promise<RawImportedEvent[]> {
  const config = readTicketPlatformConfig(input.importSource);
  const adapter = getTicketPlatformAdapter(config.platform);
  const userAgent = config.userAgent ?? DEFAULT_USER_AGENT;
  const listUrl = config.listUrl ?? resolveTicketShopBaseUrl(config.shopSlug);

  const html =
    input.fixtureHtml ??
    input.importSource.sourceConfig?.reference?.html ??
    (await fetchShopHtml(listUrl, userAgent));

  const { events, scopeStats } = adapter.parseShopHtml(html, config);

  return events.map((event) => {
    const normalized = toNormalizedTicketFields(event);
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
      rawSourceType: 'json_ld',
      sourceMetadata: {
        connector: input.connectorKey,
        platform: config.platform,
        shopSlug: config.shopSlug,
        enrichmentSource: true,
        scopeStats,
        ...(event.checkoutProviderId
          ? { checkoutProviderId: event.checkoutProviderId }
          : {}),
      },
    };
  });
}
