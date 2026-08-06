import type { ConnectorNormalizedOutput } from '@/features/aggregation/domain/connector-normalized-contract';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { RegisteredSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';

export type SourceModuleSyncCompleteness = 'complete' | 'partial' | 'unknown';
export type SourceModuleErrorCategory =
  | 'configuration'
  | 'authentication'
  | 'rate_limited'
  | 'blocked'
  | 'network'
  | 'parse'
  | 'upstream'
  | 'unknown';

export interface SourceModuleCursor {
  value: string;
  hasMore: boolean;
}

export interface SourceModuleCompletenessReport {
  status: SourceModuleSyncCompleteness;
  discovered: number;
  fetched: number;
  normalized: number;
  skipped: number;
  nextCursor?: SourceModuleCursor;
  warnings: string[];
}

export interface SourceModuleHealth {
  healthy: boolean;
  errorCategory?: SourceModuleErrorCategory;
  checkedAt: string;
  message?: string;
}

export interface SourceModuleRuntime {
  source: AggregationSource;
  importSource: ImportSource;
  context: PipelineRunContext;
}

/**
 * Platform boundary for discovery and extraction. The shared aggregation
 * pipeline owns validation, matching, persistence, provenance, and projection.
 */
export interface SourceModule {
  readonly id: string;
  readonly connectorVersion: string;
  detectUrl(url: string): boolean;
  normalizeUrl(url: string): string | undefined;
  deriveSourceIdentity(url: string): string | undefined;
  probe(url: string): Promise<SourceModuleHealth>;
  discover(input: {
    url: string;
    cursor?: SourceModuleCursor;
    runtime: SourceModuleRuntime;
  }): Promise<RawImportedEvent[]>;
  fetch(input: {
    url: string;
    externalId: string;
    runtime: SourceModuleRuntime;
  }): Promise<RawImportedEvent | undefined>;
  paginate?(input: { url: string; cursor?: SourceModuleCursor }): Promise<SourceModuleCursor | undefined>;
  parse?(raw: unknown): RawImportedEvent[];
  normalize?(raw: RawImportedEvent): CanonicalImportEvent | undefined;
  /** Maps adapter output to the shared normalized contract before pipeline merge. */
  toNormalizedOutput?(raw: RawImportedEvent): ConnectorNormalizedOutput;
  classifyRelevance?(raw: RawImportedEvent): 'relevant' | 'uncertain' | 'irrelevant';
  extractStableExternalId(raw: RawImportedEvent): string | undefined;
  reportCompleteness(input: {
    discovered: number;
    fetched: number;
    normalized: number;
    skipped: number;
    nextCursor?: SourceModuleCursor;
    warnings?: string[];
  }): SourceModuleCompletenessReport;
  determineNextCursor?(raw: unknown): SourceModuleCursor | undefined;
  healthCheck(url: string): Promise<SourceModuleHealth>;
}

/** Bridges existing connectors into the future platform-module registry without changing parsers. */
export function adaptRegisteredConnectorToSourceModule(
  connector: RegisteredSourceConnector,
): SourceModule {
  const version = connector.describeVersion().connectorVersion;

  return {
    id: connector.connectorKey,
    connectorVersion: version,
    detectUrl: (url) => Boolean(normalizeUrl(url)),
    normalizeUrl,
    deriveSourceIdentity: (url) => {
      try {
        return new URL(url).hostname.toLowerCase();
      } catch {
        return undefined;
      }
    },
    async probe(url) {
      const normalized = normalizeUrl(url);
      return {
        healthy: Boolean(normalized),
        checkedAt: new Date().toISOString(),
        ...(normalized ? {} : { errorCategory: 'configuration' as const, message: 'Invalid source URL.' }),
      };
    },
    async discover({ runtime }) {
      return connector.fetchRawEvents(runtime.source, runtime.importSource, runtime.context);
    },
    async fetch({ externalId, runtime }) {
      const events = await connector.fetchRawEvents(runtime.source, runtime.importSource, runtime.context);
      return events.find((event) => event.externalId === externalId);
    },
    extractStableExternalId: (raw) => raw.externalId || raw.importId,
    reportCompleteness: (input) => ({
      status: input.nextCursor?.hasMore ? 'partial' : input.warnings?.length ? 'unknown' : 'complete',
      discovered: input.discovered,
      fetched: input.fetched,
      normalized: input.normalized,
      skipped: input.skipped,
      nextCursor: input.nextCursor,
      warnings: input.warnings ?? [],
    }),
    healthCheck: async (url) => ({
      healthy: Boolean(normalizeUrl(url)),
      checkedAt: new Date().toISOString(),
      ...(normalizeUrl(url) ? {} : { errorCategory: 'configuration' as const }),
    }),
  };
}

function normalizeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return undefined;
    }
    url.hash = '';
    return url.toString();
  } catch {
    return undefined;
  }
}
