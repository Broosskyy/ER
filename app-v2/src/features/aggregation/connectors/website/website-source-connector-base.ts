import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent, SourceConnectorKey } from '@/features/aggregation/connectors/types';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';

export async function fetchWebsiteConnectorEvents(input: {
  source: AggregationSource;
  importSource: ImportSource;
  _context: PipelineRunContext;
  connectorKey: SourceConnectorKey;
  defaultUrl: string;
  fixtureHtml?: string;
}): Promise<RawImportedEvent[]> {
  const url =
    input.importSource.sourceUrl ??
    input.importSource.sourceConfig?.jsonLd?.pageUrl ??
    input.importSource.website ??
    input.source.url ??
    input.defaultUrl;

  const htmlOverride =
    input.importSource.sourceConfig?.reference?.html ??
    (input.fixtureHtml && url.includes('events.example.com') ? input.fixtureHtml : undefined);

  const { events } = await websiteProcessor.process({
    url,
    importSource: input.importSource,
    connectorKey: input.connectorKey,
    htmlOverride,
  });

  return events.map((event) => ({
    ...event,
    sourceMetadata: {
      ...event.sourceMetadata,
      connector: input.connectorKey,
    },
  }));
}
