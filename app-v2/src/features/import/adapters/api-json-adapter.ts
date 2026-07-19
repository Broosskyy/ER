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
import { importFetchService } from '@/features/import/services/import-fetch-service';

function getByPath(obj: unknown, path?: string): unknown {
  if (!path) return undefined;
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

const ALLOWED_API_HEADERS: Record<string, string | undefined> = {
  'x-api-key': process.env.IMPORT_API_HEADER_X_API_KEY,
  authorization: process.env.IMPORT_API_HEADER_AUTHORIZATION,
  'x-auth-token': process.env.IMPORT_API_HEADER_X_AUTH_TOKEN,
};

function resolveApiHeaders(headerNames: string[] = []): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const name of headerNames) {
    const value = ALLOWED_API_HEADERS[name.toLowerCase()];
    if (value) {
      headers[name] = value;
    }
  }
  return headers;
}

function mapApiItem(
  item: Record<string, unknown>,
  mapping: CsvFieldMapping,
  index: number,
) {
  const get = (key?: string) => {
    const value = key ? getByPath(item, key) : undefined;
    return value !== undefined && value !== null ? String(value) : undefined;
  };

  return {
    externalId: get(mapping.externalId) || `api-item-${index + 1}`,
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
    rawSourceType: 'api_json' as const,
    sourceMetadata: item,
  };
}

export class ApiJsonImportAdapter implements ImportSourceAdapter {
  readonly adapterKey = 'api_json';

  async execute(source: ImportSource, context: ImportAdapterContext) {
    const config = source.sourceConfig?.api;
    if (!config?.fieldMapping) {
      throw new Error('API JSON source requires sourceConfig.api.fieldMapping.');
    }

    const url = source.sourceUrl ?? source.website;
    if (!url) {
      throw new Error('API JSON source requires sourceUrl.');
    }

    const parsedUrl = new URL(url);
    if (config.queryParams) {
      for (const [key, value] of Object.entries(config.queryParams)) {
        parsedUrl.searchParams.set(key, value);
      }
    }

    const response = await importFetchService.fetch({
      url: parsedUrl.toString(),
      allowedContentTypes: ['application/json'],
      headers: resolveApiHeaders(config.headerNames),
    });

    let payload: unknown;
    try {
      payload = JSON.parse(response.body) as unknown;
    } catch {
      throw new Error('Invalid JSON response from API.');
    }

    const list = getByPath(payload, config.resultsPath);
    const items = Array.isArray(list) ? list : list ? [list] : [];

    const warnings: string[] = [];
    const records: ImportAdapterRecordResult[] = [];
    let skippedCount = 0;

    items.forEach((item, index) => {
      if (!item || typeof item !== 'object') {
        skippedCount += 1;
        records.push(createSkippedRecord(`api-skip-${index}`, {}, 'Invalid API item type.'));
        return;
      }

      const candidate = mapApiItem(item as Record<string, unknown>, config.fieldMapping, index);
      if (!candidate.title || !candidate.startDate) {
        skippedCount += 1;
        warnings.push(`Skipped API item ${index + 1} — missing title or startDate.`);
        records.push(
          createSkippedRecord(candidate.externalId, item as Record<string, unknown>, 'Missing required API fields.'),
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

    await context.log('info', 'API_JSON_PARSED', `Parsed ${records.length} API items.`);

    return buildAdapterResult(records, warnings, skippedCount, {
      url: parsedUrl.toString(),
      itemCount: items.length,
    });
  }
}
