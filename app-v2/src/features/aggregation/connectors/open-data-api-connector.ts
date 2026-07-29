import { importFetchService } from '@/features/import/services/import-fetch-service';
import { OPEN_DATA_API_FIXTURE } from '@/features/aggregation/fixtures/real-source-fixtures';
import { mapOpenDataApiEvent } from '@/features/aggregation/connectors/open-data-api-mapper';
import { BaseSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';
import { SOURCE_CONNECTOR_DEFINITIONS } from '@/features/aggregation/connectors/framework/connector-definitions';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import { ImportExecutionError } from '@/features/import/errors/import-errors';
const ALLOWED_AUTH_ENV_TOKENS: Record<string, string | undefined> = {
  ER_PARTNER_V1_API_TOKEN: process.env.ER_PARTNER_V1_API_TOKEN,
};

function resolveAuthToken(tokenEnvKey: string): string | undefined {
  return ALLOWED_AUTH_ENV_TOKENS[tokenEnvKey];
}

function resolveFetchHeaders(importSource: ImportSource): Record<string, string> {
  const auth = importSource.sourceConfig?.auth;
  if (auth?.type === 'bearer' && auth.tokenEnvKey) {
    const token = resolveAuthToken(auth.tokenEnvKey);
    if (token?.trim()) {
      return { Authorization: `Bearer ${token.trim()}` };
    }
  }
  if (auth?.type === 'api_key' && auth.headerName && auth.tokenEnvKey) {
    const token = resolveAuthToken(auth.tokenEnvKey);
    if (token?.trim()) {
      return { [auth.headerName]: token.trim() };
    }
  }
  return {};
}

function readResults(
  parsed: Record<string, unknown>,
  resultsPath: string,
): Record<string, unknown>[] {
  const items = readPath(parsed, resultsPath);
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
}

function readPath(root: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, root);
}

async function loadApiPayload(importSource: ImportSource): Promise<Record<string, unknown>> {
  const configured = importSource.sourceConfig?.reference?.apiJson;
  if (configured !== undefined) {
    return typeof configured === 'string'
      ? (JSON.parse(configured) as Record<string, unknown>)
      : (configured as Record<string, unknown>);
  }

  const url = importSource.sourceUrl ?? importSource.website;
  if (!url) {
    return JSON.parse(OPEN_DATA_API_FIXTURE) as Record<string, unknown>;
  }

  try {
    const response = await importFetchService.fetch({
      url,
      allowedContentTypes: ['application/json'],
      headers: resolveFetchHeaders(importSource),
    });
    return JSON.parse(response.body) as Record<string, unknown>;
  } catch (error) {
    throw new ImportExecutionError(
      error instanceof Error ? error.message : 'Open data API fetch failed.',
      'IMPORT_EXECUTION_FAILED',
    );
  }
}

export class OpenDataApiConnector extends BaseSourceConnector {
  readonly connectorKey = 'open_data_api' as const;
  protected readonly definition = SOURCE_CONNECTOR_DEFINITIONS.open_data_api;
  async fetchRawEvents(
    _source: AggregationSource,
    importSource: ImportSource,
    _context: PipelineRunContext,
  ): Promise<RawImportedEvent[]> {
    const parsed = await loadApiPayload(importSource);
    const resultsPath = importSource.sourceConfig?.api?.resultsPath ?? 'events';
    const fieldMapping = importSource.sourceConfig?.api?.fieldMapping;
    const sourceUrl = importSource.sourceUrl ?? importSource.website ?? '';
    const items = readResults(parsed, resultsPath);

    return items
      .map((item, index) =>
        mapOpenDataApiEvent(item, {
          sourceUrl,
          index,
          fieldMapping,
          connectorKey: this.connectorKey,
        }),
      )
      .filter((event): event is RawImportedEvent => event !== null);
  }
}
