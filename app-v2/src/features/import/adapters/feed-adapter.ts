import type { ImportSource } from '@/features/import/models/types';
import type { FeedFieldMapping } from '@/features/import/models/source-config';
import type { ImportAdapterContext, ImportSourceAdapter } from '@/features/import/adapters/types';
import {
  buildAdapterResult,
  createSkippedRecord,
  processRawCandidate,
} from '@/features/import/adapters/adapter-utils';
import { importFetchService } from '@/features/import/services/import-fetch-service';
import {
  parseFeedXml,
  type FeedType,
} from '@/features/import/parsers/feed-parser';

export function createFeedAdapter(feedType: FeedType): ImportSourceAdapter {
  return {
    adapterKey: feedType,
    async execute(source: ImportSource, context: ImportAdapterContext) {
      const url = source.sourceConfig?.feed?.feedUrl ?? source.sourceUrl ?? source.website;
      if (!url) {
        throw new Error(`${feedType.toUpperCase()} source requires feedUrl or sourceUrl.`);
      }

      const response = await importFetchService.fetch({
        url,
        allowedContentTypes: [
          'application/xml',
          'text/xml',
          'application/rss+xml',
          'application/atom+xml',
        ],
      });

      const items = parseFeedXml(response.body, feedType, {
        mapping: source.sourceConfig?.feed,
        feedUrl: url,
        locationField: source.sourceConfig?.feed?.locationField,
        eventDateField: source.sourceConfig?.feed?.eventDateField,
      });

      const warnings: string[] = [];
      const records = [];
      let skippedCount = 0;

      for (const item of items) {
        if (!item.title?.trim()) {
          warnings.push('Skipped feed item — missing title.');
          skippedCount += 1;
          records.push(createSkippedRecord(item.externalId, item.sourceMetadata, 'Missing title in feed item.'));
          continue;
        }

        records.push(
          processRawCandidate(
            {
              externalId: item.externalId,
              sourceUrl: item.sourceUrl,
              title: item.title,
              description: item.description ? String(item.description) : undefined,
              startDate: item.startDate ? String(item.startDate) : undefined,
              eventUrl: typeof item.eventUrl === 'string' ? item.eventUrl : undefined,
              imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
              venueName:
                typeof item.location === 'string'
                  ? item.location
                  : source.name,
              cityName: source.name,
              rawSourceType: feedType,
              sourceMetadata: item.sourceMetadata,
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
