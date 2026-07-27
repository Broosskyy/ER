import { ClubWebsiteConnector } from '@/features/aggregation/connectors/club-website-connector';
import { IcalFeedConnector } from '@/features/aggregation/connectors/ical-feed-connector';
import { ManualReferenceConnector } from '@/features/aggregation/connectors/manual-reference-connector';
import { OpenDataApiConnector } from '@/features/aggregation/connectors/open-data-api-connector';
import { OrganizerWebsiteConnector } from '@/features/aggregation/connectors/organizer-website-connector';
import type { SourceConnector, SourceConnectorKey } from '@/features/aggregation/connectors/types';

export class SourceConnectorRegistry {
  private readonly connectors = new Map<SourceConnectorKey, SourceConnector>();

  constructor(connectors: SourceConnector[] = []) {
    for (const connector of connectors) {
      this.register(connector);
    }
  }

  register(connector: SourceConnector): void {
    this.connectors.set(connector.connectorKey, connector);
  }

  get(key: SourceConnectorKey): SourceConnector {
    const connector = this.connectors.get(key);
    if (!connector) {
      throw new Error(`Source connector "${key}" is not registered.`);
    }
    return connector;
  }

  resolveConnectorKey(input: {
    connectorKey?: SourceConnectorKey;
    parserType?: string;
    sourceType?: string;
    adapterKey?: string;
  }): SourceConnectorKey {
    if (input.connectorKey) {
      return input.connectorKey;
    }
    if (input.adapterKey === 'ical' || input.parserType === 'ical') {
      return 'ical_feed';
    }
    if (input.adapterKey === 'api_json' || input.parserType === 'api') {
      return 'open_data_api';
    }
    if (input.sourceType === 'manual') {
      return 'manual_reference';
    }
    if (input.sourceType === 'website' && input.parserType === 'html') {
      return 'organizer_website';
    }
    return 'club_website';
  }
}

export function createDefaultSourceConnectorRegistry(): SourceConnectorRegistry {
  return new SourceConnectorRegistry([
    new ManualReferenceConnector(),
    new ClubWebsiteConnector(),
    new OrganizerWebsiteConnector(),
    new IcalFeedConnector(),
    new OpenDataApiConnector(),
  ]);
}

export const sourceConnectorRegistry = createDefaultSourceConnectorRegistry();
