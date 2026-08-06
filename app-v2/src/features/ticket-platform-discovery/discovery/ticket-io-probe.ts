import { parseTicketIoShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-io-adapter';
import {
  extractTicketIoShopSlug,
  normalizeTicketIoListUrl,
  parseTicketIoUrl,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { defaultHttpClient } from '@/features/endpoints/http/default-http-client';
import type { TicketPlatformSourceConfig } from '@/features/aggregation/connectors/ticket-platform/types';

const DEFAULT_USER_AGENT =
  'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)';

const PAGINATION_HINT_PATTERN =
  /rel=["']next["']|pagination|data-page|load\s*more|show\s*more/i;

export interface TicketIoProbePreviewEvent {
  title: string;
  startDate: string;
  ticketUrl: string;
  venueName?: string;
  availability?: string;
}

export interface TicketIoProbeResult {
  shopSlug: string;
  listUrl: string;
  valid: boolean;
  eventCount: number;
  paginationDetected: boolean;
  requiredFieldsValid: boolean;
  preview: TicketIoProbePreviewEvent[];
  warnings: string[];
  scopeStats: ReturnType<typeof parseTicketIoShopHtml>['scopeStats'];
}

function detectPaginationHints(html: string): boolean {
  return PAGINATION_HINT_PATTERN.test(html);
}

function validateRequiredFields(
  events: ReturnType<typeof parseTicketIoShopHtml>['events'],
): boolean {
  if (events.length === 0) {
    return false;
  }
  return events.every((event) => Boolean(event.title?.trim() && event.startDate && event.ticketUrl));
}

export async function probeTicketIoShopUrl(
  urlOrSlug: string,
  scope?: TicketPlatformSourceConfig['scope'],
  options: { fixtureHtml?: string } = {},
): Promise<TicketIoProbeResult | null> {
  const parsed = parseTicketIoUrl(urlOrSlug) ?? (extractTicketIoShopSlug(urlOrSlug)
    ? {
        shopSlug: extractTicketIoShopSlug(urlOrSlug)!,
        listUrl: normalizeTicketIoListUrl(urlOrSlug),
        normalizedUrl: normalizeTicketIoListUrl(urlOrSlug),
        externalShopId: extractTicketIoShopSlug(urlOrSlug)!,
      }
    : null);

  if (!parsed) {
    return null;
  }

  const warnings: string[] = [];
  const listUrl = parsed.listUrl;
  const html =
    options.fixtureHtml ??
    (await (async () => {
      const response = await defaultHttpClient.fetch(listUrl, {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
      });
      if (!response.ok) {
        warnings.push(`Shop fetch failed with HTTP ${response.status}.`);
        return '';
      }
      return response.text();
    })());

  if (!html) {
    return {
      shopSlug: parsed.shopSlug,
      listUrl,
      valid: false,
      eventCount: 0,
      paginationDetected: false,
      requiredFieldsValid: false,
      preview: [],
      warnings,
      scopeStats: { discovered: 0, accepted: 0, rejected: 0, rejectionReasons: {} },
    };
  }

  const config: TicketPlatformSourceConfig = {
    platform: 'ticket_io',
    shopSlug: parsed.shopSlug,
    listUrl,
    timezone: 'Europe/Berlin',
    limits: { maxEventsPerRun: 100, requestsPerMinute: 15 },
    scope: {
      requireElectronicSignal: true,
      ...scope,
    },
  };

  const { events, scopeStats } = parseTicketIoShopHtml(html, config);
  const paginationDetected = detectPaginationHints(html);
  const requiredFieldsValid = validateRequiredFields(events);

  if (scopeStats.rejected > 0) {
    warnings.push(
      `${scopeStats.rejected} events rejected by electronic scope filter.`,
    );
  }
  if (paginationDetected) {
    warnings.push('Pagination hints detected — connector currently reads a single list page.');
  }
  if (!requiredFieldsValid && events.length > 0) {
    warnings.push('Some events are missing required fields (title, startDate, ticketUrl).');
  }
  if (events.length === 0 && scopeStats.discovered === 0) {
    warnings.push('No JSON-LD events discovered on shop list page.');
  }

  const preview: TicketIoProbePreviewEvent[] = events.slice(0, 5).map((event) => ({
    title: event.title,
    startDate: event.startDate,
    ticketUrl: event.ticketUrl,
    venueName: event.venueName,
    availability: event.availability,
  }));

  const importableCount = scopeStats.accepted + (scopeStats.uncertain ?? 0);

  return {
    shopSlug: parsed.shopSlug,
    listUrl,
    valid: importableCount > 0 && requiredFieldsValid,
    eventCount: importableCount,
    paginationDetected,
    requiredFieldsValid,
    preview,
    warnings,
    scopeStats,
  };
}
