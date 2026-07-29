import { XMLParser } from 'fast-xml-parser';

import type { FeedFieldMapping } from '@/features/import/models/source-config';
import type { RawSourceType } from '@/features/import/models/normalized-event-candidate';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  cdataPropName: '__cdata',
});

export type FeedType = 'rss' | 'atom';

export interface ParsedFeedItem {
  externalId: string;
  title?: string;
  description?: unknown;
  sourceUrl?: string;
  eventUrl?: unknown;
  startDate?: unknown;
  imageUrl?: unknown;
  location?: unknown;
  rawSourceType: RawSourceType;
  sourceMetadata: Record<string, unknown>;
}

export function getFeedFieldValue(item: Record<string, unknown>, field?: string): unknown {
  if (!field) return undefined;
  const parts = field.split('.');
  let current: unknown = item;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  if (current && typeof current === 'object' && '__cdata' in (current as Record<string, unknown>)) {
    return (current as Record<string, unknown>).__cdata;
  }
  if (current && typeof current === 'object' && '@_href' in (current as Record<string, unknown>)) {
    return (current as Record<string, unknown>)['@_href'];
  }
  return current;
}

export function normalizeFeedItems(
  parsed: Record<string, unknown>,
  feedType: FeedType,
): Record<string, unknown>[] {
  if (feedType === 'rss') {
    const rss = parsed.rss as Record<string, unknown> | undefined;
    const channel = (rss?.channel ?? parsed.channel) as Record<string, unknown> | undefined;
    const items = channel?.item;
    if (!items) return [];
    return Array.isArray(items) ? (items as Record<string, unknown>[]) : [items as Record<string, unknown>];
  }
  const feed = parsed.feed as Record<string, unknown> | undefined;
  const entries = feed?.entry;
  if (!entries) return [];
  return Array.isArray(entries) ? (entries as Record<string, unknown>[]) : [entries as Record<string, unknown>];
}

export function defaultFeedFieldMapping(feedType: FeedType): FeedFieldMapping {
  if (feedType === 'rss') {
    return {
      titleField: 'title',
      descriptionField: 'description',
      urlField: 'link',
      dateField: 'pubDate',
      externalIdField: 'guid',
      imageField: 'enclosure.@_url',
    };
  }
  return {
    titleField: 'title',
    descriptionField: 'content',
    urlField: 'link.@_href',
    dateField: 'updated',
    externalIdField: 'id',
  };
}

export function parseFeedXml(
  body: string,
  feedType: FeedType,
  options: {
    mapping?: FeedFieldMapping;
    feedUrl: string;
    locationField?: string;
    eventDateField?: string;
  },
): ParsedFeedItem[] {
  let parsed: Record<string, unknown>;
  try {
    parsed = xmlParser.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error(`Invalid ${feedType.toUpperCase()} XML.`);
  }

  const mapping = { ...defaultFeedFieldMapping(feedType), ...options.mapping };
  const locationField = options.locationField ?? 'location';
  const eventDateField = options.eventDateField ?? mapping.dateField;
  const items = normalizeFeedItems(parsed, feedType);

  return items.map((item, index) => {
    const title = getFeedFieldValue(item, mapping.titleField);
    const externalId = String(
      getFeedFieldValue(item, mapping.externalIdField) ??
        getFeedFieldValue(item, mapping.urlField) ??
        title ??
        `feed-${index}`,
    );

    return {
      externalId,
      title: title ? String(title) : undefined,
      description: getFeedFieldValue(item, mapping.descriptionField),
      sourceUrl: String(getFeedFieldValue(item, mapping.urlField) ?? options.feedUrl),
      eventUrl: getFeedFieldValue(item, mapping.urlField),
      startDate: getFeedFieldValue(item, eventDateField),
      imageUrl: getFeedFieldValue(item, mapping.imageField),
      location: getFeedFieldValue(item, locationField),
      rawSourceType: feedType,
      sourceMetadata: item,
    };
  });
}

export function mapParsedFeedItemToRawImportedEvent(
  item: ParsedFeedItem,
  connectorKey: string,
): import('@/features/aggregation/connectors/types').RawImportedEvent | null {
  if (!item.title?.trim()) {
    return null;
  }

  const location =
    typeof item.location === 'string'
      ? item.location
      : item.location && typeof item.location === 'object'
        ? String((item.location as Record<string, unknown>).name ?? '')
        : undefined;

  return {
    externalId: item.externalId,
    importId: item.externalId,
    sourceUrl: item.sourceUrl,
    originalLink: typeof item.eventUrl === 'string' ? item.eventUrl : item.sourceUrl,
    title: item.title,
    description: item.description ? String(item.description) : undefined,
    startDate: item.startDate ? String(item.startDate) : undefined,
    venueName: location || undefined,
    venueAddress: location || undefined,
    eventUrl: typeof item.eventUrl === 'string' ? item.eventUrl : undefined,
    imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
    rawSourceType: item.rawSourceType,
    sourceMetadata: {
      connector: connectorKey,
      feedItem: item.sourceMetadata,
    },
  };
}
