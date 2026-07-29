import { BaseSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';
import { SOURCE_CONNECTOR_DEFINITIONS } from '@/features/aggregation/connectors/framework/connector-definitions';
import { SourceConnectorError } from '@/features/aggregation/connectors/framework/errors';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import { importFetchService } from '@/features/import/services/import-fetch-service';
import {
  mapParsedCsvRowToRawImportedEvent,
  parseCsvSourceContent,
} from '@/features/import/parsers/csv-source-parser';

async function resolveCsvContent(importSource: ImportSource): Promise<{ content: string; url?: string }> {
  const inline = importSource.sourceConfig?.reference?.csv;
  if (inline) {
    return { content: inline, url: importSource.sourceUrl ?? importSource.website };
  }

  const url = importSource.sourceUrl ?? importSource.website;
  if (!url) {
    throw new SourceConnectorError({
      code: 'configuration_invalid',
      message: 'CSV source requires sourceUrl, website, or reference.csv.',
      retryable: false,
    });
  }

  const response = await importFetchService.fetch({
    url,
    allowedContentTypes: ['text/csv', 'text/plain', 'application/csv'],
  });

  return { content: response.body, url };
}

export class CsvImportConnector extends BaseSourceConnector {
  readonly connectorKey = 'csv_import' as const;
  protected readonly definition = SOURCE_CONNECTOR_DEFINITIONS.csv_import;

  async fetchRawEvents(
    _source: AggregationSource,
    importSource: ImportSource,
    _context: PipelineRunContext,
  ): Promise<RawImportedEvent[]> {
    const config = importSource.sourceConfig?.csv;
    if (!config?.fieldMapping) {
      throw new SourceConnectorError({
        code: 'configuration_invalid',
        message: 'CSV source requires sourceConfig.csv.fieldMapping.',
        retryable: false,
      });
    }

    const { content, url } = await resolveCsvContent(importSource);
    const rows = parseCsvSourceContent(content, config, {
      encoding: config.encoding,
      maxSizeBytes: config.maxSizeBytes,
    });

    return rows
      .map((row) => mapParsedCsvRowToRawImportedEvent(row, this.connectorKey, url))
      .filter((event): event is RawImportedEvent => event !== null);
  }
}
