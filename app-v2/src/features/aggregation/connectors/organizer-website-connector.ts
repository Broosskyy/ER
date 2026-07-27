import { ClubWebsiteConnector } from '@/features/aggregation/connectors/club-website-connector';
import { ORGANIZER_WEBSITE_FIXTURE_HTML } from '@/features/aggregation/fixtures/real-source-fixtures';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent, SourceConnector } from '@/features/aggregation/connectors/types';

export class OrganizerWebsiteConnector implements SourceConnector {
  readonly connectorKey = 'organizer_website' as const;
  private readonly clubParser = new ClubWebsiteConnector();

  async fetchRawEvents(
    source: AggregationSource,
    importSource: ImportSource,
    context: PipelineRunContext,
  ): Promise<RawImportedEvent[]> {
    const importWithFixture: ImportSource = {
      ...importSource,
      sourceConfig: {
        ...importSource.sourceConfig,
        reference: {
          ...importSource.sourceConfig?.reference,
          html: importSource.sourceConfig?.reference?.html ?? ORGANIZER_WEBSITE_FIXTURE_HTML,
        },
      },
    };

    const events = await this.clubParser.fetchRawEvents(source, importWithFixture, context);
    return events.map((event) => ({
      ...event,
      sourceMetadata: {
        ...event.sourceMetadata,
        connector: 'organizer_website',
      },
    }));
  }
}
