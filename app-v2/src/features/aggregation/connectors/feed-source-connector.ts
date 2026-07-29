import { SourceConnectorError } from '@/features/aggregation/connectors/framework/errors';
import { BaseSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';
import { SOURCE_CONNECTOR_DEFINITIONS } from '@/features/aggregation/connectors/framework/connector-definitions';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import { importFetchService } from '@/features/import/services/import-fetch-service';
import {
  mapParsedFeedItemToRawImportedEvent,
  parseFeedXml,
  type FeedType,
} from '@/features/import/parsers/feed-parser';

function resolveFeedBody(importSource: ImportSource, feedType: FeedType): Promise<{ body: string; url: string }> {
  const inline = importSource.sourceConfig?.reference?.feed;
  const url = importSource.sourceConfig?.feed?.feedUrl ?? importSource.sourceUrl ?? importSource.website;
  if (inline) {
    return Promise.resolve({ body: inline, url: url ?? `inline://${feedType}` });
  }
  if (!url) {
    throw new SourceConnectorError({
      code: 'configuration_invalid',
      message: `${feedType.toUpperCase()} source requires feedUrl, sourceUrl, or reference.feed.`,
      retryable: false,
    });
  }
  return importFetchService
    .fetch({
      url,
      allowedContentTypes: [
        'application/xml',
        'text/xml',
        'application/rss+xml',
        'application/atom+xml',
      ],
    })
    .then((response) => ({ body: response.body, url }));
}

export abstract class FeedSourceConnector extends BaseSourceConnector {
  constructor(
    readonly connectorKey: 'rss_feed' | 'atom_feed',
    private readonly feedType: FeedType,
  ) {
    super();
  }

  async fetchRawEvents(
    _source: AggregationSource,
    importSource: ImportSource,
    _context: PipelineRunContext,
  ): Promise<RawImportedEvent[]> {
    const { body, url } = await resolveFeedBody(importSource, this.feedType);
    const items = parseFeedXml(body, this.feedType, {
      mapping: importSource.sourceConfig?.feed,
      feedUrl: url,
      locationField: importSource.sourceConfig?.feed?.locationField,
      eventDateField: importSource.sourceConfig?.feed?.eventDateField,
    });

    return items
      .map((item) => mapParsedFeedItemToRawImportedEvent(item, this.connectorKey))
      .filter((event): event is RawImportedEvent => event !== null);
  }
}

export class RssFeedConnector extends FeedSourceConnector {
  readonly connectorKey = 'rss_feed' as const;
  protected readonly definition = SOURCE_CONNECTOR_DEFINITIONS.rss_feed;

  constructor() {
    super('rss_feed', 'rss');
  }
}

export class AtomFeedConnector extends FeedSourceConnector {
  readonly connectorKey = 'atom_feed' as const;
  protected readonly definition = SOURCE_CONNECTOR_DEFINITIONS.atom_feed;

  constructor() {
    super('atom_feed', 'atom');
  }
}
