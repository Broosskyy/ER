import { FIELD_LIMITS } from '@/features/import/config/import-config';
import type { NormalizedEventCandidate, RawSourceType } from '@/features/import/models/normalized-event-candidate';
import { parseImportDate } from '@/features/import/normalization/date-time-normalizer';
import { normalizeStringList, normalizeText } from '@/features/import/normalization/text-normalizer';
import { resolveUrl } from '@/features/import/normalization/url-normalizer';
import type { ValidationIssue } from '@/features/import/validation/validation-codes';

export interface RawCandidateInput {
  externalId: string;
  sourceUrl?: string;
  title?: unknown;
  description?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  timezone?: string;
  isAllDay?: boolean;
  venueName?: unknown;
  venueAddress?: unknown;
  cityName?: unknown;
  countryCode?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  artistNames?: unknown;
  genreNames?: unknown;
  ticketUrl?: unknown;
  eventUrl?: unknown;
  imageUrl?: unknown;
  minimumAge?: unknown;
  organizerName?: unknown;
  rawSourceType: RawSourceType;
  sourceMetadata?: Record<string, unknown>;
  baseUrl?: string;
  defaultTimezone?: string;
}

function parseCoordinate(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(num) ? num : undefined;
}

function parseMinimumAge(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const match = String(value).match(/\d+/);
  if (!match) return undefined;
  const age = Number.parseInt(match[0], 10);
  return Number.isFinite(age) ? age : undefined;
}

function normalizeCountryCode(value: unknown): string | undefined {
  const text = normalizeText(value, 8);
  if (!text) return undefined;
  const upper = text.toUpperCase();
  return /^[A-Z]{2,3}$/.test(upper) ? upper : undefined;
}

export class EventNormalizer {
  normalize(input: RawCandidateInput): {
    candidate?: NormalizedEventCandidate;
    warnings: ValidationIssue[];
  } {
    const warnings: ValidationIssue[] = [];
    const baseUrl = input.baseUrl ?? input.sourceUrl;

    const title = normalizeText(input.title, FIELD_LIMITS.title);
    if (!title) {
      return { warnings };
    }

    const start = parseImportDate(input.startDate, {
      defaultTimezone: input.defaultTimezone ?? input.timezone,
      field: 'startDate',
    });
    warnings.push(...start.warnings);
    if (!start.valid || !start.isoDate) {
      return { warnings };
    }

    let endDate: string | undefined;
    if (input.endDate) {
      const end = parseImportDate(input.endDate, {
        defaultTimezone: input.defaultTimezone ?? input.timezone,
        field: 'endDate',
      });
      warnings.push(...end.warnings);
      endDate = end.isoDate;
    }

    const latitude = parseCoordinate(input.latitude);
    const longitude = parseCoordinate(input.longitude);

    const candidate: NormalizedEventCandidate = {
      externalId: normalizeText(input.externalId, FIELD_LIMITS.field) ?? input.externalId,
      sourceUrl: resolveUrl(input.sourceUrl, baseUrl),
      title,
      description: normalizeText(input.description, FIELD_LIMITS.description),
      startDate: start.isoDate,
      endDate,
      timezone: start.timezone ?? input.timezone ?? input.defaultTimezone,
      isAllDay: input.isAllDay ?? start.isAllDay,
      venueName: normalizeText(input.venueName),
      venueAddress: normalizeText(input.venueAddress),
      cityName: normalizeText(input.cityName),
      countryCode: normalizeCountryCode(input.countryCode),
      latitude,
      longitude,
      artistNames: normalizeStringList(input.artistNames),
      genreNames: normalizeStringList(input.genreNames),
      ticketUrl: resolveUrl(String(input.ticketUrl ?? ''), baseUrl),
      eventUrl: resolveUrl(String(input.eventUrl ?? ''), baseUrl),
      imageUrl: resolveUrl(String(input.imageUrl ?? ''), baseUrl),
      minimumAge: parseMinimumAge(input.minimumAge),
      organizerName: normalizeText(input.organizerName),
      rawSourceType: input.rawSourceType,
      sourceMetadata: input.sourceMetadata,
    };

    return { candidate, warnings };
  }
}

export const eventNormalizer = new EventNormalizer();
