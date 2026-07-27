import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { importFetchService } from '@/features/import/services/import-fetch-service';
import { CLUB_WEBSITE_FIXTURE_HTML } from '@/features/aggregation/fixtures/real-source-fixtures';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent, SourceConnector } from '@/features/aggregation/connectors/types';

function mapJsonLdToRaw(event: Record<string, unknown>, baseUrl: string, index: number): RawImportedEvent | null {
  if (!event.startDate) {
    return null;
  }

  const parsed = parseJsonLdEvent(event, baseUrl);
  const externalId = parsed.externalId || `club-${index}`;

  return {
    externalId,
    importId: externalId,
    sourceUrl: typeof event.url === 'string' ? event.url : baseUrl,
    originalLink: typeof event.url === 'string' ? event.url : baseUrl,
    title: typeof parsed.fields.title === 'string' ? parsed.fields.title : undefined,
    subtitle: typeof event.alternateName === 'string' ? event.alternateName : undefined,
    description: typeof parsed.fields.description === 'string' ? parsed.fields.description : undefined,
    startDate: typeof parsed.fields.startDate === 'string' ? parsed.fields.startDate : undefined,
    endDate: typeof parsed.fields.endDate === 'string' ? parsed.fields.endDate : undefined,
    venueName: typeof parsed.fields.venueName === 'string' ? parsed.fields.venueName : undefined,
    venueAddress: typeof parsed.fields.venueAddress === 'string' ? parsed.fields.venueAddress : undefined,
    cityName: typeof parsed.fields.cityName === 'string' ? parsed.fields.cityName : undefined,
    countryCode: typeof parsed.fields.countryCode === 'string' ? parsed.fields.countryCode : undefined,
    latitude: typeof parsed.fields.latitude === 'number' ? parsed.fields.latitude : undefined,
    longitude: typeof parsed.fields.longitude === 'number' ? parsed.fields.longitude : undefined,
    artistNames: Array.isArray(parsed.fields.artistNames) ? parsed.fields.artistNames : undefined,
    genreNames: Array.isArray(parsed.fields.genreNames) ? parsed.fields.genreNames : undefined,
    ticketUrl: typeof parsed.fields.ticketUrl === 'string' ? parsed.fields.ticketUrl : undefined,
    eventUrl: typeof parsed.fields.eventUrl === 'string' ? parsed.fields.eventUrl : undefined,
    imageUrl: typeof parsed.fields.imageUrl === 'string' ? parsed.fields.imageUrl : undefined,
    organizerName: typeof parsed.fields.organizerName === 'string' ? parsed.fields.organizerName : undefined,
    rawSourceType: 'json_ld',
    sourceMetadata: { connector: 'club_website' },
  };
}

export class ClubWebsiteConnector implements SourceConnector {
  readonly connectorKey = 'club_website' as const;

  async fetchRawEvents(
    source: AggregationSource,
    importSource: ImportSource,
    _context: PipelineRunContext,
  ): Promise<RawImportedEvent[]> {
    const fixtureHtml = importSource.sourceConfig?.reference?.html ?? CLUB_WEBSITE_FIXTURE_HTML;
    const url =
      importSource.sourceUrl ??
      importSource.sourceConfig?.jsonLd?.pageUrl ??
      importSource.website ??
      source.url;

    const useFixture = importSource.sourceConfig?.reference?.html !== undefined || !url;
    const html = useFixture
      ? fixtureHtml
      : (
          await importFetchService.fetch({
            url: url!,
            allowedContentTypes: ['text/html', 'application/json', 'application/ld+json'],
          })
        ).body;

    const blocks = html.trim().startsWith('{')
      ? [JSON.parse(html) as unknown]
      : extractJsonLdBlocks(html);

    const events: RawImportedEvent[] = [];
    let index = 0;
    for (const block of blocks) {
      for (const node of collectJsonLdNodes(block)) {
        const mapped = mapJsonLdToRaw(node as Record<string, unknown>, url ?? '', index);
        if (mapped) {
          events.push(mapped);
          index += 1;
        }
      }
    }

    return events;
  }
}
