import { createHash } from 'node:crypto';

import { parseTicketIoListRowContexts } from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-enrichment';
import { extractTicketIoShopSlug, isTicketIoShopRootUrl } from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { GOLD_STANDARD_REFERENCE_EVENTS } from '@/features/import/pilots/gold-standard-reference';
import { pilotFetchHtml } from '@/features/import/pilots/gold-standard-reference';

export type LiveSampleImporter = 'official-website' | 'ticket-io' | 'ticket-kings' | 'nacht-manager';

export interface LiveSampleItem {
  sampleId: string;
  eventId: string;
  label: string;
  importer: LiveSampleImporter;
  url: string;
  host?: string;
  websiteUrl?: string;
  ticketUrl?: string;
  sourceId?: string;
  categoryTags: string[];
}

export const KNOWN_TICKET_IO_HOSTS = [
  'bootshaus-club',
  'bootshaus-tickets',
  'lehmannclub',
  'technodampfer',
  'proton-the-club',
  'protontheclub',
  'area51events',
  'hmg-concerts',
  'unreal-bootshaus',
  'blacklist',
  'polyamor',
] as const;

export type FieldComparisonStatus =
  | 'UNIFIED_CORRECT'
  | 'LEGACY_CORRECT'
  | 'BOTH_CORRECT'
  | 'UNIFIED_BETTER'
  | 'LEGACY_BETTER'
  | 'BOTH_INCORRECT'
  | 'PUBLIC_SOURCE_HAS_NO_FIELD'
  | 'PUBLIC_DETAIL_EXTERNALLY_BLOCKED'
  | 'IMPORTER_UNSUPPORTED'
  | 'IDENTITY_REVIEW_REQUIRED'
  | 'GROUND_TRUTH_REVIEW_REQUIRED';

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function normalizeUrlKey(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

function isEventSpecificTicketIoUrl(url: string): boolean {
  return url.includes('ticket.io') && !isTicketIoShopRootUrl(url) && /\/[A-Za-z0-9]{4,}\/?$/.test(url);
}

function isTicketKingsEventUrl(url: string): boolean {
  return /ticketkings\.de\/event\//i.test(url);
}

function isOfficialWebsiteUrl(url: string): boolean {
  return /bootshaus\.tv\/events\//i.test(url) || /affenkaefig\.info\/event\//i.test(url);
}

interface ImportRecordRow {
  id: string;
  source_id?: string;
  external_id?: string;
  canonical_event_id?: string;
  resulting_event_id?: string;
  raw_payload?: Record<string, unknown>;
}

interface EventRowLite {
  id: string;
  title: string;
  ticket_url?: string | null;
  website_url?: string | null;
  status?: string;
}

export async function buildLiveSampleFromDb(
  opsQuery: {
    importRecords: () => Promise<ImportRecordRow[]>;
    events: () => Promise<EventRowLite[]>;
  },
): Promise<LiveSampleItem[]> {
  const items: LiveSampleItem[] = [];
  const seenUrls = new Set<string>();

  const add = (item: Omit<LiveSampleItem, 'sampleId'> & { sampleId?: string }): void => {
    const key = `${item.importer}::${normalizeUrlKey(item.url)}`;
    if (seenUrls.has(key)) return;
    seenUrls.add(key);
    items.push({
      ...item,
      sampleId: item.sampleId ?? `${item.importer}-${items.length + 1}`,
    });
  };

  for (const ref of GOLD_STANDARD_REFERENCE_EVENTS) {
    if (ref.websiteUrl) {
      add({
        eventId: ref.eventId,
        label: ref.label,
        importer: 'official-website',
        url: ref.websiteUrl,
        websiteUrl: ref.websiteUrl,
        ticketUrl: ref.ticketUrl,
        categoryTags: ['gold_standard', ref.websiteUrl.includes('affenkaefig') ? 'affenkaefig' : 'bootshaus'],
      });
    }
    if (ref.platform === 'ticket_io') {
      add({
        eventId: ref.eventId,
        label: ref.label,
        importer: 'ticket-io',
        url: ref.ticketUrl,
        host: extractTicketIoShopSlug(ref.ticketUrl) ?? undefined,
        ticketUrl: ref.ticketUrl,
        websiteUrl: ref.websiteUrl,
        categoryTags: ['gold_standard', 'ticket_io'],
      });
    }
    if (ref.platform === 'ticket_kings') {
      add({
        eventId: ref.eventId,
        label: ref.label,
        importer: 'ticket-kings',
        url: ref.ticketUrl,
        ticketUrl: ref.ticketUrl,
        websiteUrl: ref.websiteUrl,
        categoryTags: ['gold_standard', 'ticket_kings'],
      });
      add({
        eventId: ref.eventId,
        label: ref.label,
        importer: 'nacht-manager',
        url: ref.ticketUrl,
        ticketUrl: ref.ticketUrl,
        categoryTags: ['gold_standard', 'nacht_manager', 'checkout_probe'],
      });
    }
  }

  const records = await opsQuery.importRecords();
  const events = await opsQuery.events();
  const eventsById = new Map(events.map((e) => [e.id, e]));

  for (const record of records) {
    const eventId = record.canonical_event_id ?? record.resulting_event_id ?? `import-${record.id}`;
    const payload = record.raw_payload ?? {};
    const title = String(payload.title ?? eventsById.get(eventId)?.title ?? record.external_id ?? 'Unknown');
    const externalId = String(record.external_id ?? payload.ticketUrl ?? payload.websiteUrl ?? '');

    if (isEventSpecificTicketIoUrl(externalId)) {
      add({
        eventId,
        label: title,
        importer: 'ticket-io',
        url: externalId,
        host: extractTicketIoShopSlug(externalId) ?? undefined,
        ticketUrl: externalId,
        sourceId: record.source_id,
        categoryTags: ['import_record', 'ticket_io'],
      });
    }
    if (isTicketKingsEventUrl(externalId)) {
      add({
        eventId,
        label: title,
        importer: 'ticket-kings',
        url: externalId,
        ticketUrl: externalId,
        sourceId: record.source_id,
        categoryTags: ['import_record', 'ticket_kings'],
      });
      add({
        eventId,
        label: title,
        importer: 'nacht-manager',
        url: externalId,
        ticketUrl: externalId,
        sourceId: record.source_id,
        categoryTags: ['import_record', 'nacht_manager', 'checkout_probe'],
      });
    }
    const websiteUrl = String(payload.websiteUrl ?? payload.eventUrl ?? '');
    if (isOfficialWebsiteUrl(websiteUrl)) {
      const tags = ['import_record'];
      if (websiteUrl.includes('bootshaus')) tags.push('bootshaus');
      if (websiteUrl.includes('affenkaefig')) tags.push('affenkaefig', 'external_promoted');
      add({
        eventId,
        label: title,
        importer: 'official-website',
        url: websiteUrl,
        websiteUrl,
        ticketUrl: String(payload.ticketUrl ?? ''),
        sourceId: record.source_id,
        categoryTags: tags,
      });
    }
  }

  for (const event of events) {
    const websiteUrl = event.website_url ?? '';
    const ticketUrl = event.ticket_url ?? '';
    if (isOfficialWebsiteUrl(websiteUrl)) {
      const tags = ['published_event'];
      if (websiteUrl.includes('bootshaus')) tags.push('bootshaus');
      if (websiteUrl.includes('affenkaefig')) tags.push('affenkaefig');
      add({
        eventId: event.id,
        label: event.title,
        importer: 'official-website',
        url: websiteUrl,
        websiteUrl,
        ticketUrl: ticketUrl || undefined,
        categoryTags: tags,
      });
    }
    if (isEventSpecificTicketIoUrl(ticketUrl)) {
      add({
        eventId: event.id,
        label: event.title,
        importer: 'ticket-io',
        url: ticketUrl,
        host: extractTicketIoShopSlug(ticketUrl) ?? undefined,
        ticketUrl,
        categoryTags: ['published_event', 'ticket_io'],
      });
    }
    if (isTicketKingsEventUrl(ticketUrl)) {
      add({
        eventId: event.id,
        label: event.title,
        importer: 'ticket-kings',
        url: ticketUrl,
        ticketUrl,
        categoryTags: ['published_event', 'ticket_kings'],
      });
    }
  }

  const ticketIoCount = items.filter((i) => i.importer === 'ticket-io').length;
  if (ticketIoCount < 30) {
    for (const host of KNOWN_TICKET_IO_HOSTS) {
      const listUrl = `https://${host}.ticket.io/`;
      const fetch = await pilotFetchHtml(listUrl);
      if (!fetch.html) continue;
      const rows = parseTicketIoListRowContexts(fetch.html);
      for (const slug of rows.keys()) {
        const eventUrl = `https://${host}.ticket.io/${slug}/`;
        if (items.filter((i) => i.importer === 'ticket-io').length >= 40) break;
        add({
          eventId: `live-tio-${host}-${slug}`,
          label: `${host} / ${slug}`,
          importer: 'ticket-io',
          url: eventUrl,
          host,
          ticketUrl: eventUrl,
          categoryTags: ['list_discovery', host, rows.get(slug)?.soldOut ? 'sold_out' : 'available'],
        });
      }
    }
  }

  const websiteItems = items.filter((i) => i.importer === 'official-website');
  const minWebsite = 20;
  if (websiteItems.length < minWebsite) {
    for (const event of events) {
      if (websiteItems.length >= minWebsite) break;
      const u = event.website_url ?? '';
      if (u && !seenUrls.has(`official-website::${normalizeUrlKey(u)}`)) {
        add({
          eventId: event.id,
          label: event.title,
          importer: 'official-website',
          url: u,
          websiteUrl: u,
          categoryTags: ['published_event', 'website_supplement'],
        });
      }
    }
  }

  return items;
}

export function sampleSummaryByImporter(items: LiveSampleItem[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const item of items) {
    summary[item.importer] = (summary[item.importer] ?? 0) + 1;
  }
  return summary;
}

export function sampleSummaryByTicketIoHost(items: LiveSampleItem[]): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const item of items.filter((i) => i.importer === 'ticket-io')) {
    const host = item.host ?? 'unknown';
    summary[host] = (summary[host] ?? 0) + 1;
  }
  return summary;
}
