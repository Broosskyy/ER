import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
} from '@/features/import/adapters/parsers/json-ld-parser';
import type {
  WebsiteDetectedSignal,
  WebsiteDetectionReport,
  WebsiteDocument,
  WebsiteStrategyKey,
} from '@/features/aggregation/connectors/website/types';
import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import { deduplicateUrls, resolveRelativeUrl } from '@/features/aggregation/connectors/website/security';
import { extractLinks, extractTextContent } from '@/features/aggregation/connectors/website/html-utils';

const NEXT_DATA_PATTERN = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
const NUXT_PATTERN = /window\.__NUXT__\s*=\s*(\{[\s\S]*?\});/i;
const RSS_LINK_PATTERN = /<link[^>]+type=["']application\/rss\+xml["'][^>]*>/gi;
const ICAL_LINK_PATTERN = /<link[^>]+type=["']text\/calendar["'][^>]*>/gi;
const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\.\d{1,2}\.\d{4}\b/g;

function detectJsonLd(html: string): WebsiteDetectedSignal[] {
  const blocks = extractJsonLdBlocks(html);
  const events = blocks.flatMap((block) => collectJsonLdNodes(block));
  if (events.length === 0) return [];
  return [
    { format: 'json_ld', confidence: 0.95, count: blocks.length },
    { format: 'schema_org_event', confidence: 0.9, count: events.length },
  ];
}

function detectEmbeddedJson(html: string): WebsiteDetectedSignal[] {
  const signals: WebsiteDetectedSignal[] = [];
  if (NEXT_DATA_PATTERN.test(html)) {
    signals.push({ format: 'next_data', confidence: 0.9, count: 1 });
    signals.push({ format: 'embedded_json', confidence: 0.85, count: 1 });
  }
  if (NUXT_PATTERN.test(html)) {
    signals.push({ format: 'nuxt_payload', confidence: 0.85, count: 1 });
    signals.push({ format: 'embedded_json', confidence: 0.8, count: 1 });
  }
  if (/<script[^>]*type=["']application\/json["'][^>]*>/i.test(html)) {
    signals.push({ format: 'embedded_json', confidence: 0.75, count: 1 });
  }
  return signals;
}

function detectLinksAndLists(html: string, baseUrl: string, config: WebsiteConnectorConfig) {
  const detailSelector =
    config.eventDetailPage?.eventLinkSelector ??
    config.htmlSelector?.eventUrlSelector ??
    'a';
  const detailUrls = deduplicateUrls(
    extractLinks(html, detailSelector, config.htmlSelector?.eventUrlAttribute ?? 'href')
      .map((href) => resolveRelativeUrl(baseUrl, href))
      .filter((url): url is string => Boolean(url)),
  );

  const containerSelector = config.htmlSelector?.eventContainerSelector ?? '.event';
  const containerCount = extractTextContent(html, containerSelector).length;

  return { detailUrls, containerCount };
}

export function detectWebsiteDocument(
  document: WebsiteDocument,
  config: WebsiteConnectorConfig = {},
): WebsiteDetectionReport {
  const html = document.html;
  const baseUrl = document.finalUrl;
  const signals: WebsiteDetectedSignal[] = [
    ...detectJsonLd(html),
    ...detectEmbeddedJson(html),
  ];

  if (RSS_LINK_PATTERN.test(html)) {
    signals.push({ format: 'rss_link', confidence: 0.7, count: 1 });
  }
  if (ICAL_LINK_PATTERN.test(html)) {
    signals.push({ format: 'ical_link', confidence: 0.7, count: 1 });
  }

  const { detailUrls, containerCount } = detectLinksAndLists(html, baseUrl, config);
  if (containerCount > 0) {
    signals.push({ format: 'event_list', confidence: 0.65, count: containerCount });
    signals.push({ format: 'event_card', confidence: 0.6, count: containerCount });
  }
  if (detailUrls.length > 0) {
    signals.push({ format: 'event_detail_link', confidence: 0.7, count: detailUrls.length });
  }

  const ticketLinks = deduplicateUrls(
    extractLinks(html, 'a', 'href').filter((href) => /ticket|buy|shop/i.test(href)),
  );
  if (ticketLinks.length > 0) {
    signals.push({ format: 'ticket_link', confidence: 0.6, count: ticketLinks.length });
  }

  const imageSources = deduplicateUrls(extractLinks(html, 'img', 'src'));
  if (imageSources.length > 0) {
    signals.push({ format: 'image_source', confidence: 0.5, count: imageSources.length });
  }

  const dateFieldCount = (html.match(DATE_PATTERN) ?? []).length;
  if (dateFieldCount > 0) {
    signals.push({ format: 'structured_date', confidence: 0.55, count: dateFieldCount });
  }

  const venueMatches = html.match(/venue|location|addressLocality|Place/gi) ?? [];
  if (venueMatches.length > 0) {
    signals.push({ format: 'structured_venue', confidence: 0.5, count: venueMatches.length });
  }

  const paginationDetected =
    Boolean(config.htmlSelector?.paginationSelector || config.htmlSelector?.nextPageSelector) ||
    /rel=["']next["']|load more|weitere events/i.test(html);
  if (paginationDetected) {
    signals.push({ format: 'pagination_hint', confidence: 0.55, count: 1 });
  }
  if (/load more|mehr laden/i.test(html)) {
    signals.push({ format: 'load_more_hint', confidence: 0.5, count: 1 });
  }

  const javascriptRenderingSuspected =
    /<div[^>]+id=["']root["'][^>]*>\s*<\/div>/i.test(html) ||
    /enable javascript|requires javascript/i.test(html);
  if (javascriptRenderingSuspected) {
    signals.push({ format: 'client_rendered_suspected', confidence: 0.7, count: 1 });
  }

  const strategyScores = ([
    {
      key: 'json_ld' as const,
      confidence: signals.find((s) => s.format === 'schema_org_event')?.confidence ?? 0,
      eventCountEstimate: signals.find((s) => s.format === 'schema_org_event')?.count ?? 0,
    },
    {
      key: 'embedded_json' as const,
      confidence: signals.find((s) => s.format === 'embedded_json')?.confidence ?? 0,
      eventCountEstimate: 0,
    },
    {
      key: 'html_selector' as const,
      confidence: containerCount > 0 ? 0.7 : 0,
      eventCountEstimate: containerCount,
    },
    {
      key: 'event_detail_page' as const,
      confidence: detailUrls.length > 0 ? 0.75 : 0,
      eventCountEstimate: detailUrls.length,
    },
    {
      key: 'custom_adapter' as const,
      confidence: config.customAdapter?.adapterKey ? 0.5 : 0,
      eventCountEstimate: 0,
    },
  ] satisfies Array<{ key: WebsiteStrategyKey; confidence: number; eventCountEstimate: number }>).filter(
    (entry) => entry.confidence > 0,
  );

  const recommendedStrategy =
    config.preferredStrategy ??
    [...strategyScores].sort((left, right) => right.confidence - left.confidence)[0]?.key ??
    'html_selector';

  const blockers = javascriptRenderingSuspected
    ? [{ code: 'client_rendered', message: 'Page may require JavaScript rendering.' }]
    : [];

  return {
    requestedUrl: document.requestedUrl,
    finalUrl: document.finalUrl,
    detectedStrategies: strategyScores,
    detectedFormats: signals,
    eventContainerCount: containerCount,
    detailPageUrls: detailUrls,
    paginationDetected,
    ticketLinks: ticketLinks.map((href) => resolveRelativeUrl(baseUrl, href) ?? href),
    imageSources,
    dateFieldCount,
    venueFieldCount: venueMatches.length,
    javascriptRenderingSuspected,
    warnings: javascriptRenderingSuspected ? ['javascript_rendering_suspected'] : [],
    blockers,
    recommendedStrategy,
    recommendedNextAction: blockers.length > 0
      ? 'blocked'
      : recommendedStrategy === 'html_selector' && containerCount === 0
        ? 'configure_selectors'
        : recommendedStrategy === 'event_detail_page'
          ? 'fetch_details'
          : 'extract',
  };
}
