import type { CsvFieldMapping } from '@/features/import/models/source-config';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';

const DEFAULT_FIELD_MAPPING: CsvFieldMapping = {
  externalId: 'id',
  title: 'name',
  description: 'description',
  startDate: 'starts_at',
  endDate: 'ends_at',
  venueName: 'venue',
  cityName: 'city',
  ticketUrl: 'ticket_url',
  imageUrl: 'image_url',
  organizerName: 'organizer',
  eventUrl: 'url',
};

function readPath(item: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, item);
}

function readString(item: Record<string, unknown>, path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }
  const value = readPath(item, path);
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function readStringList(item: Record<string, unknown>, path: string | undefined): string[] | undefined {
  if (!path) {
    return undefined;
  }
  const value = readPath(item, path);
  if (!Array.isArray(value)) {
    return undefined;
  }

  const names = value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim();
      }
      if (entry && typeof entry === 'object' && typeof (entry as { name?: string }).name === 'string') {
        return (entry as { name: string }).name.trim();
      }
      return '';
    })
    .filter(Boolean);

  return names.length > 0 ? names : undefined;
}

export function mapOpenDataApiEvent(
  item: Record<string, unknown>,
  options: {
    sourceUrl: string;
    index: number;
    fieldMapping?: CsvFieldMapping;
    connectorKey?: string;
  },
): RawImportedEvent | null {
  const mapping = { ...DEFAULT_FIELD_MAPPING, ...options.fieldMapping };

  const externalId =
    readString(item, mapping.externalId) ??
    readString(item, 'external_id') ??
    `api-${options.index}`;
  const title =
    readString(item, mapping.title) ??
    readString(item, 'title') ??
    '';
  const startDate =
    readString(item, mapping.startDate) ??
    readString(item, 'startDate') ??
    readString(item, 'start_date') ??
    '';

  if (!title || !startDate) {
    return null;
  }

  const artistNames =
    readStringList(item, mapping.artistNames) ??
    readStringList(item, 'artists') ??
    readStringList(item, 'lineup') ??
    readStringList(item, 'performers');
  const genreNames =
    readStringList(item, mapping.genreNames) ??
    readStringList(item, 'genres') ??
    readStringList(item, 'tags');
  const timezone = readString(item, 'timezone') ?? readString(item, 'timezone_name');
  const imageUrl = readString(item, mapping.imageUrl);
  const imageUrls = readStringList(item, 'images');

  return {
    externalId,
    importId: externalId,
    sourceUrl: options.sourceUrl,
    originalLink: readString(item, mapping.eventUrl) ?? readString(item, 'url') ?? options.sourceUrl,
    title,
    subtitle: readString(item, 'subtitle'),
    description: readString(item, mapping.description),
    startDate,
    endDate: readString(item, mapping.endDate),
    timezone,
    venueName: readString(item, mapping.venueName),
    venueAddress: readString(item, mapping.venueAddress),
    cityName: readString(item, mapping.cityName),
    countryCode: readString(item, mapping.countryCode),
    genreNames,
    artistNames,
    organizerName: readString(item, mapping.organizerName),
    ticketUrl: readString(item, mapping.ticketUrl),
    eventUrl: readString(item, mapping.eventUrl),
    imageUrl,
    imageUrls: imageUrl ? [imageUrl, ...(imageUrls ?? [])] : imageUrls,
    rawSourceType: 'api_json',
    sourceMetadata: {
      connector: options.connectorKey ?? 'open_data_api',
      raw: item,
    },
  };
}
