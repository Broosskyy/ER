import type { CsvFieldMapping, CsvSourceConfig } from '@/features/import/models/source-config';
import { mapCsvRow, parseCsv } from '@/features/import/adapters/parsers/csv-parser';
import { sanitizeCsvFormula } from '@/features/import/normalization/text-normalizer';

export interface ParsedCsvRow {
  externalId: string;
  title?: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  countryCode?: string;
  artistNames?: string;
  genreNames?: string;
  ticketUrl?: string;
  eventUrl?: string;
  imageUrl?: string;
  minimumAge?: string;
  organizerName?: string;
  rawSourceType: 'csv';
  sourceMetadata: Record<string, string>;
}

const DEFAULT_CSV_MAX_BYTES = 5 * 1024 * 1024;

function decodeCsvContent(content: string, encoding = 'utf-8'): string {
  if (encoding === 'utf-8' || encoding === 'utf8') {
    return content;
  }
  try {
    const bytes = new Uint8Array([...content].map((char) => char.charCodeAt(0)));
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return content;
  }
}

export function assertCsvContentWithinLimit(content: string, maxSizeBytes = DEFAULT_CSV_MAX_BYTES): void {
  const size = new TextEncoder().encode(content).byteLength;
  if (size > maxSizeBytes) {
    throw new Error(`CSV content exceeds maximum size of ${maxSizeBytes} bytes.`);
  }
}

function mapCsvRowToParsed(
  row: Record<string, string>,
  mapping: CsvFieldMapping,
  index: number,
): ParsedCsvRow {
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
    rawSourceType: 'csv',
    sourceMetadata: row,
  };
}

export function parseCsvSourceContent(
  content: string,
  config: CsvSourceConfig,
  options: { maxSizeBytes?: number; encoding?: string } = {},
): ParsedCsvRow[] {
  const encoding = options.encoding ?? config.encoding ?? 'utf-8';
  const maxSizeBytes = options.maxSizeBytes ?? config.maxSizeBytes ?? DEFAULT_CSV_MAX_BYTES;
  assertCsvContentWithinLimit(content, maxSizeBytes);

  const decoded = decodeCsvContent(content, encoding);
  const { headers, rows } = parseCsv(decoded, {
    delimiter: config.delimiter ?? ',',
    hasHeader: config.hasHeader ?? true,
  });

  return rows.map((row, index) => mapCsvRowToParsed(mapCsvRow(headers, row), config.fieldMapping, index));
}

export function mapParsedCsvRowToRawImportedEvent(
  row: ParsedCsvRow,
  connectorKey: string,
  sourceUrl?: string,
): import('@/features/aggregation/connectors/types').RawImportedEvent | null {
  if (!row.title?.trim() || !row.startDate?.trim()) {
    return null;
  }

  return {
    externalId: row.externalId,
    importId: row.externalId,
    sourceUrl: sourceUrl ?? row.eventUrl,
    originalLink: row.eventUrl ?? sourceUrl,
    title: row.title,
    description: row.description,
    startDate: row.startDate,
    endDate: row.endDate,
    venueName: row.venueName,
    venueAddress: row.venueAddress,
    cityName: row.cityName,
    countryCode: row.countryCode,
    artistNames: row.artistNames?.split(/[,;|]/).map((name) => name.trim()).filter(Boolean),
    genreNames: row.genreNames?.split(/[,;|]/).map((name) => name.trim()).filter(Boolean),
    ticketUrl: row.ticketUrl,
    eventUrl: row.eventUrl,
    imageUrl: row.imageUrl,
    organizerName: row.organizerName,
    rawSourceType: 'csv',
    sourceMetadata: {
      connector: connectorKey,
      row: row.sourceMetadata,
    },
  };
}
