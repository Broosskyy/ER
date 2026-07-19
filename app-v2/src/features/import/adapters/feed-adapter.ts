import { XMLParser } from 'fast-xml-parser';

import type { ImportSource } from '@/features/import/models/types';
import type { FeedFieldMapping } from '@/features/import/models/source-config';
import type { ImportAdapterContext, ImportSourceAdapter } from '@/features/import/adapters/types';
import {
  buildAdapterResult,
  createSkippedRecord,
  getSourceUrl,
  processRawCandidate,
} from '@/features/import/adapters/adapter-utils';
import { importFetchService } from '@/features/import/services/import-fetch-service';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  trimValues: true,
  cdataPropName: '__cdata',
});

function getFieldValue(item: Record<string, unknown>, field?: string): unknown {
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

function normalizeFeedItems(parsed: Record<string, unknown>, feedType: 'rss' | 'atom'): Record<string, unknown>[] {
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

function defaultMapping(feedType: 'rss' | 'atom'): FeedFieldMapping {
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

export function createFeedAdapter(feedType: 'rss' | 'atom'): ImportSourceAdapter {
  return {
    adapterKey: feedType,
    async execute(source: ImportSource, context: ImportAdapterContext) {
      const url = source.sourceConfig?.feed?.feedUrl ?? source.sourceUrl ?? source.website;
      if (!url) {
        throw new Error(`${feedType.toUpperCase()} source requires feedUrl or sourceUrl.`);
      }

      const response = await importFetchService.fetch({
        url,
        allowedContentTypes: ['application/xml', 'text/xml', 'application/rss+xml', 'application/atom+xml'],
      });

      let parsed: Record<string, unknown>;
      try {
        parsed = xmlParser.parse(response.body) as Record<string, unknown>;
      } catch {
        throw new Error(`Invalid ${feedType.toUpperCase()} XML.`);
      }

      const mapping = { ...defaultMapping(feedType), ...source.sourceConfig?.feed };
      const items = normalizeFeedItems(parsed, feedType);
      const warnings: string[] = [];
      const records = [];
      let skippedCount = 0;

      for (const item of items) {
        const title = getFieldValue(item, mapping.titleField);
        const externalId = String(
          getFieldValue(item, mapping.externalIdField) ?? getFieldValue(item, mapping.urlField) ?? title ?? `feed-${skippedCount}`,
        );

        if (!title) {
          warnings.push(`Skipped feed item — missing title.`);
          skippedCount += 1;
          records.push(createSkippedRecord(externalId, item, 'Missing title in feed item.'));
          continue;
        }

        records.push(
          processRawCandidate(
            {
              externalId,
              sourceUrl: String(getFieldValue(item, mapping.urlField) ?? url),
              title,
              description: getFieldValue(item, mapping.descriptionField),
              startDate: getFieldValue(item, mapping.dateField),
              eventUrl: getFieldValue(item, mapping.urlField),
              imageUrl: getFieldValue(item, mapping.imageField),
              cityName: source.name,
              rawSourceType: feedType,
              sourceMetadata: item,
              baseUrl: url,
            },
            source,
          ),
        );
      }

      await context.log('info', `${feedType.toUpperCase()}_PARSED`, `Parsed ${records.length} feed items.`);

      return buildAdapterResult(records, warnings, skippedCount, {
        feedType,
        url,
        itemCount: items.length,
      });
    },
  };
}

export const rssImportAdapter = createFeedAdapter('rss');
export const atomImportAdapter = createFeedAdapter('atom');
