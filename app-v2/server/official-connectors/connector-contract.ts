import type { ConnectorErrorCounters, OfficialEventConsumerPreview, OfficialEventEvidence } from './types';
import type { SafeFetchRequestContext, SafeFetchRequestOptions } from './generic-safe-fetch';

export type OfficialSourceType = 'venue_club' | 'festival' | 'organizer' | 'event_platform';

export interface OfficialConnectorCapabilities {
  listDiscovery: boolean;
  detailFetch: boolean;
  mediaEnrichment: boolean;
}

export interface OfficialConnectorMetadata {
  connectorId: string;
  sourceType: OfficialSourceType;
  displayName: string;
  defaultListUrl?: string;
  capabilities: OfficialConnectorCapabilities;
}

export interface OfficialConnectorDiscoveryResult {
  listUrl: string;
  detailUrls: string[];
  duplicateCount: number;
}

export interface OfficialConnectorFetchResult {
  finalUrl: string;
  html: string;
  contentType: string;
}

export interface OfficialConnectorRunOptions {
  now?: () => Date;
  maxDetailPages?: number;
  writeCache?: (relativePath: string, contents: string) => Promise<void>;
}

export interface OfficialConnectorRunResult {
  fetchedAt: string;
  listUrl: string;
  discoveredDetailUrls: string[];
  loadedDetailUrls: string[];
  previews: OfficialEventConsumerPreview[];
  counters: ConnectorErrorCounters;
  mediaCounters: import('./media-evidence/types').MediaPassCounters;
}

export interface OfficialConnector {
  readonly metadata: OfficialConnectorMetadata;
  discoverFromListHtml(listHtml: string, listUrl: string): OfficialConnectorDiscoveryResult;
  fetchHtml(url: string, options: SafeFetchRequestOptions, context?: SafeFetchRequestContext): Promise<OfficialConnectorFetchResult>;
  parseDetailPage(
    html: string,
    finalUrl: string,
    fetchedAt: string,
    counters: ConnectorErrorCounters,
  ): OfficialEventEvidence;
  runPreview(options?: OfficialConnectorRunOptions): Promise<OfficialConnectorRunResult>;
}
