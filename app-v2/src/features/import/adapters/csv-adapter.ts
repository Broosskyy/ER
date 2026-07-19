import type { ImportSource } from '@/features/import/models/types';
import type { CsvFieldMapping } from '@/features/import/models/source-config';
import type {
  ImportAdapterContext,
  ImportAdapterRecordResult,
  ImportSourceAdapter,
} from '@/features/import/adapters/types';
import {
  buildAdapterResult,
  createSkippedRecord,
  processRawCandidate,
} from '@/features/import/adapters/adapter-utils';
import { mapCsvRow, parseCsv } from '@/features/import/adapters/parsers/csv-parser';
import { importFetchService } from '@/features/import/services/import-fetch-service';
import { sanitizeCsvFormula } from '@/features/import/normalization/text-normalizer';

function mapCsvToCandidate(
  row: Record<string, string>,
  mapping: CsvFieldMapping,
  index: number,
) {
  const get = (key?: string) => (key ? sanitizeCsvFormula(row[key] ?? '') : undefined);
  const externalId = get(mapping.externalId) || `csv-row-${index + 1}`;

  return {
    externalId,
    title: get(mapping.title),
    description: get(mapping.description),
    startDate: get(mapping.startDate),
    endDate: get(mapping.endDate),
    venueName: get(mapping.venueName),
    venueAddress: get(mapping.venueAddress),
    cityName: get(mapping.cityName),
    countryCode: get(mapping.countryCode),
    artistNames: get(mapping.artistNames),
    genreNames: get(mapping.genreNames),
    ticketUrl: get(mapping.ticketUrl),
    eventUrl: get(mapping.eventUrl),
    imageUrl: get(mapping.imageUrl),
    minimumAge: get(mapping.minimumAge),
    organizerName: get(mapping.organizerName),
    rawSourceType: 'csv' as const,
    sourceMetadata: row,
  };
}

export class CsvImportAdapter implements ImportSourceAdapter {
  readonly adapterKey = 'csv';

  async execute(source: ImportSource, context: ImportAdapterContext) {
    const config = source.sourceConfig?.csv;
    if (!config?.fieldMapping) {
      throw new Error('CSV source requires sourceConfig.csv.fieldMapping.');
    }

    const url = source.sourceUrl ?? source.website;
    if (!url) {
      throw new Error('CSV source requires sourceUrl.');
    }

    const response = await importFetchService.fetch({
      url,
      allowedContentTypes: ['text/csv', 'text/plain', 'application/csv'],
    });

    const { headers, rows } = parseCsv(response.body, {
      delimiter: config.delimiter ?? ',',
      hasHeader: config.hasHeader ?? true,
    });

    const warnings: string[] = [];
    const records: ImportAdapterRecordResult[] = [];
    let skippedCount = 0;

    rows.forEach((row, index) => {
      const mapped = mapCsvRow(headers, row);
      const candidate = mapCsvToCandidate(mapped, config.fieldMapping, index);

      if (!candidate.title || !candidate.startDate) {
        skippedCount += 1;
        warnings.push(`Skipped CSV row ${index + 1} — missing title or startDate.`);
        records.push(
          createSkippedRecord(
            candidate.externalId,
            mapped,
            'Missing required CSV columns (title or startDate).',
          ),
        );
        return;
      }

      records.push(
        processRawCandidate(
          {
            ...candidate,
            baseUrl: url,
          },
          source,
        ),
      );
    });

    await context.log('info', 'CSV_PARSED', `Parsed ${records.length} CSV rows.`);

    return buildAdapterResult(records, warnings, skippedCount, {
      url,
      rowCount: rows.length,
      delimiter: config.delimiter ?? ',',
    });
  }
}
