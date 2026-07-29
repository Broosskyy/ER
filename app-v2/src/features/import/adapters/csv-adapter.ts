import type { ImportSource } from '@/features/import/models/types';
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
import { importFetchService } from '@/features/import/services/import-fetch-service';
import { parseCsvSourceContent } from '@/features/import/parsers/csv-source-parser';

export class CsvImportAdapter implements ImportSourceAdapter {
  readonly adapterKey = 'csv';

  async execute(source: ImportSource, context: ImportAdapterContext) {
    const config = source.sourceConfig?.csv;
    if (!config?.fieldMapping) {
      throw new Error('CSV source requires sourceConfig.csv.fieldMapping.');
    }

    const inline = source.sourceConfig?.reference?.csv;
    const url = source.sourceUrl ?? source.website;
    const content = inline
      ? inline
      : (
          await importFetchService.fetch({
            url: url!,
            allowedContentTypes: ['text/csv', 'text/plain', 'application/csv'],
          })
        ).body;

    if (!inline && !url) {
      throw new Error('CSV source requires sourceUrl or reference.csv.');
    }

    const rows = parseCsvSourceContent(content, config, {
      encoding: config.encoding,
      maxSizeBytes: config.maxSizeBytes,
    });

    const warnings: string[] = [];
    const records: ImportAdapterRecordResult[] = [];
    let skippedCount = 0;

    rows.forEach((row, index) => {
      if (!row.title?.trim() || !row.startDate?.trim()) {
        skippedCount += 1;
        warnings.push(`Skipped CSV row ${index + 1} — missing title or startDate.`);
        records.push(
          createSkippedRecord(
            row.externalId,
            row.sourceMetadata,
            'Missing required CSV columns (title or startDate).',
          ),
        );
        return;
      }

      records.push(
        processRawCandidate(
          {
            externalId: row.externalId,
            title: row.title,
            description: row.description,
            startDate: row.startDate,
            endDate: row.endDate,
            venueName: row.venueName,
            venueAddress: row.venueAddress,
            cityName: row.cityName,
            countryCode: row.countryCode,
            artistNames: row.artistNames,
            genreNames: row.genreNames,
            ticketUrl: row.ticketUrl,
            eventUrl: row.eventUrl,
            imageUrl: row.imageUrl,
            minimumAge: row.minimumAge,
            organizerName: row.organizerName,
            rawSourceType: 'csv',
            sourceMetadata: row.sourceMetadata,
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
