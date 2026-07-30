import { BaseSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';
import { SOURCE_CONNECTOR_DEFINITIONS } from '@/features/aggregation/connectors/framework/connector-definitions';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';

import { fetchTicketPlatformEvents } from './ticket-platform-fetch';

export class TicketPlatformConnector extends BaseSourceConnector {
  readonly connectorKey = 'ticket_platform' as const;
  protected readonly definition = SOURCE_CONNECTOR_DEFINITIONS.ticket_platform;

  async fetchRawEvents(
    source: AggregationSource,
    importSource: ImportSource,
    _context: PipelineRunContext,
  ): Promise<RawImportedEvent[]> {
    return fetchTicketPlatformEvents({
      source,
      importSource,
      connectorKey: this.connectorKey,
    });
  }
}
