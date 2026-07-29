import {
  CLUB_WEBSITE_FIXTURE_HTML,
  MANUAL_REFERENCE_EVENTS,
  OPEN_DATA_API_FIXTURE,
  ORGANIZER_WEBSITE_FIXTURE_HTML,
} from '@/features/aggregation/fixtures/real-source-fixtures';
import { BaseSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';
import { SOURCE_CONNECTOR_DEFINITIONS } from '@/features/aggregation/connectors/framework/connector-definitions';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';

export class ManualReferenceConnector extends BaseSourceConnector {
  readonly connectorKey = 'manual_reference' as const;
  protected readonly definition = SOURCE_CONNECTOR_DEFINITIONS.manual_reference;

  async fetchRawEvents(
    _source: AggregationSource,
    importSource: ImportSource,
    _context: PipelineRunContext,
  ): Promise<RawImportedEvent[]> {
    const configured = importSource.sourceConfig?.reference?.events;
    if (configured?.length) {
      return configured.map((event) => ({
        ...event,
        importId: event.importId ?? event.externalId,
        rawSourceType: event.rawSourceType ?? 'unknown',
      }));
    }

    return MANUAL_REFERENCE_EVENTS.map((event) => ({
      ...event,
      sourceMetadata: {
        ...event.sourceMetadata,
        fixture: true,
      },
    }));
  }
}
