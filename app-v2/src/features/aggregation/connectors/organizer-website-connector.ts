import { ORGANIZER_WEBSITE_FIXTURE_HTML } from '@/features/aggregation/fixtures/real-source-fixtures';

import { BaseSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';

import { SOURCE_CONNECTOR_DEFINITIONS } from '@/features/aggregation/connectors/framework/connector-definitions';

import { fetchWebsiteConnectorEvents } from '@/features/aggregation/connectors/website/website-source-connector-base';

import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';

import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';

import type { ImportSource } from '@/features/import/models/types';

import type { RawImportedEvent } from '@/features/aggregation/connectors/types';



export class OrganizerWebsiteConnector extends BaseSourceConnector {

  readonly connectorKey = 'organizer_website' as const;

  protected readonly definition = SOURCE_CONNECTOR_DEFINITIONS.organizer_website;



  async fetchRawEvents(

    source: AggregationSource,

    importSource: ImportSource,

    context: PipelineRunContext,

  ): Promise<RawImportedEvent[]> {

    return fetchWebsiteConnectorEvents({

      source,

      importSource,

      _context: context,

      connectorKey: this.connectorKey,

      defaultUrl: 'https://events.example.com/organizer',

      fixtureHtml: ORGANIZER_WEBSITE_FIXTURE_HTML,

    });

  }

}


