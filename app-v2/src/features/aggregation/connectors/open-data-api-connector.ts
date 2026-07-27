import { importFetchService } from '@/features/import/services/import-fetch-service';
import { OPEN_DATA_API_FIXTURE } from '@/features/aggregation/fixtures/real-source-fixtures';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent, SourceConnector } from '@/features/aggregation/connectors/types';

function mapApiEvent(
  item: Record<string, unknown>,
  sourceUrl: string,
  index: number,
): RawImportedEvent | null {
  const externalId = String(item.id ?? item.external_id ?? `api-${index}`);
  const title = String(item.name ?? item.title ?? '');
  const startDate = String(item.starts_at ?? item.startDate ?? item.start_date ?? '');
  if (!title || !startDate) {
    return null;
  }

  return {
    externalId,
    importId: externalId,
    sourceUrl,
    originalLink: typeof item.url === 'string' ? item.url : sourceUrl,
    title,
    subtitle: typeof item.subtitle === 'string' ? item.subtitle : undefined,
    description: typeof item.description === 'string' ? item.description : undefined,
    startDate,
    endDate: typeof item.ends_at === 'string' ? item.ends_at : undefined,
    cityName: typeof item.city === 'string' ? item.city : undefined,
    venueName: typeof item.venue === 'string' ? item.venue : undefined,
    ticketUrl: typeof item.ticket_url === 'string' ? item.ticket_url : undefined,
    imageUrl: typeof item.image_url === 'string' ? item.image_url : undefined,
    organizerName: typeof item.organizer === 'string' ? item.organizer : undefined,
    genreNames: Array.isArray(item.genres) ? item.genres.map(String) : undefined,
    rawSourceType: 'api_json',
    sourceMetadata: { connector: 'open_data_api' },
  };
}

export class OpenDataApiConnector implements SourceConnector {
  readonly connectorKey = 'open_data_api' as const;

  async fetchRawEvents(
    _source: AggregationSource,
    importSource: ImportSource,
    _context: PipelineRunContext,
  ): Promise<RawImportedEvent[]> {
    const url = importSource.sourceUrl ?? importSource.website;
    const configured = importSource.sourceConfig?.reference?.apiJson;
    const parsed =
      configured !== undefined
        ? typeof configured === 'string'
          ? (JSON.parse(configured) as Record<string, unknown>)
          : configured
        : url
          ? (JSON.parse(
              (
                await importFetchService.fetch({
                  url,
                  allowedContentTypes: ['application/json'],
                })
              ).body,
            ) as Record<string, unknown>)
          : (JSON.parse(OPEN_DATA_API_FIXTURE) as Record<string, unknown>);

    const resultsPath = importSource.sourceConfig?.api?.resultsPath ?? 'events';
    const items = (parsed[resultsPath] as Record<string, unknown>[] | undefined) ?? [];
    const events: RawImportedEvent[] = [];

    items.forEach((item, index) => {
      const mapped = mapApiEvent(item, url ?? '', index);
      if (mapped) {
        events.push(mapped);
      }
    });

    return events;
  }
}
