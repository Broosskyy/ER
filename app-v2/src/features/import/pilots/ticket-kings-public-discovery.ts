import { collectJsonLdNodes, extractJsonLdBlocks, parseJsonLdEvent } from '@/features/import/adapters/parsers/json-ld-parser';

export interface TicketKingsDiscoveredEvent {
  eventUrl: string;
  title?: string;
  startDate?: string;
  venueName?: string;
  cityName?: string;
  checkoutUrl?: string;
  slug: string;
  discoverySource: 'list_page' | 'json_ld' | 'sitemap';
  staleHint?: boolean;
}

const LIST_EVENT_URL_PATTERN =
  /<a[^>]+class="ect-event-url"[^>]+href="(https:\/\/ticketkings\.de\/event\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;

function slugFromUrl(url: string): string {
  return url.replace(/\/$/, '').split('/').filter(Boolean).pop() ?? '';
}

export function parseTicketKingsListHtml(html: string): TicketKingsDiscoveredEvent[] {
  const byUrl = new Map<string, TicketKingsDiscoveredEvent>();

  for (const match of html.matchAll(LIST_EVENT_URL_PATTERN)) {
    const eventUrl = match[1]!.replace(/\/$/, '') + '/';
    byUrl.set(eventUrl, {
      eventUrl,
      title: match[2]?.trim(),
      slug: slugFromUrl(eventUrl),
      discoverySource: 'list_page',
    });
  }

  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const parsed = parseJsonLdEvent(node, 'https://ticketkings.de');
      const url = String(parsed.fields.ticketUrl ?? parsed.fields.url ?? '');
      if (!url.includes('ticketkings.de/event/')) continue;
      const eventUrl = url.replace(/\/$/, '') + '/';
      const existing = byUrl.get(eventUrl);
      byUrl.set(eventUrl, {
        eventUrl,
        title: String(parsed.fields.title ?? existing?.title ?? ''),
        startDate: String(parsed.fields.startDate ?? existing?.startDate ?? ''),
        venueName: String(parsed.fields.venueName ?? existing?.venueName ?? ''),
        cityName: String(parsed.fields.cityName ?? existing?.cityName ?? ''),
        slug: slugFromUrl(eventUrl),
        discoverySource: existing ? existing.discoverySource : 'json_ld',
      });
    }
  }

  return [...byUrl.values()];
}

export function parseTicketKingsSitemapXml(xml: string): TicketKingsDiscoveredEvent[] {
  const events: TicketKingsDiscoveredEvent[] = [];
  for (const match of xml.matchAll(/<loc>(https:\/\/ticketkings\.de\/event\/[^<]+)<\/loc>/gi)) {
    const eventUrl = match[1]!.replace(/\/$/, '') + '/';
    events.push({
      eventUrl,
      slug: slugFromUrl(eventUrl),
      discoverySource: 'sitemap',
    });
  }
  return events;
}

export function mergeTicketKingsDiscoveries(
  ...lists: TicketKingsDiscoveredEvent[][]
): TicketKingsDiscoveredEvent[] {
  const byUrl = new Map<string, TicketKingsDiscoveredEvent>();
  for (const list of lists) {
    for (const item of list) {
      const existing = byUrl.get(item.eventUrl);
      byUrl.set(item.eventUrl, existing ? { ...existing, ...item, title: item.title ?? existing.title } : item);
    }
  }
  return [...byUrl.values()];
}
