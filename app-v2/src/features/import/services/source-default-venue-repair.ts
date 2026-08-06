import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import {
  extractExternalLocationFromTitle,
  isExternalLocationTitle,
} from '@/features/import/normalization/external-location-from-title';

export interface SourceDefaultVenueContext {
  defaultVenueId?: string;
  defaultVenueName?: string;
  defaultCityName?: string;
}

export function readSourceDefaultVenueContext(
  metadata: Record<string, unknown> | undefined,
): SourceDefaultVenueContext {
  const fieldDefaults = (metadata?.fieldDefaults ?? metadata?.sourceFieldDefaults) as
    | Record<string, unknown>
    | undefined;
  return {
    defaultVenueId:
      typeof fieldDefaults?.venueId === 'string' ? fieldDefaults.venueId : undefined,
    defaultVenueName:
      typeof fieldDefaults?.venueName === 'string' ? fieldDefaults.venueName : undefined,
    defaultCityName:
      typeof fieldDefaults?.cityName === 'string' ? fieldDefaults.cityName : undefined,
  };
}

function normalizeLabel(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase();
}

/** External-location events incorrectly pinned to a source's default venue/city. */
export function eventHasSourceDefaultVenueMisapplied(
  event: AdminEventRecord | null | undefined,
  context?: SourceDefaultVenueContext,
): boolean {
  if (!event || !isExternalLocationTitle(event.title)) {
    return false;
  }
  const external = extractExternalLocationFromTitle(event.title);
  if (!external) {
    return false;
  }

  if (context?.defaultVenueId && event.venueId === context.defaultVenueId) {
    return true;
  }

  const defaultVenue = normalizeLabel(context?.defaultVenueName);
  const eventVenue = normalizeLabel(event.venueName);
  if (defaultVenue && eventVenue === defaultVenue) {
    return true;
  }

  const defaultCity = normalizeLabel(context?.defaultCityName);
  const eventCity = normalizeLabel(event.venueCity);
  const externalCity = normalizeLabel(external.cityName);
  if (defaultCity && eventCity === defaultCity && externalCity && externalCity !== defaultCity) {
    return true;
  }

  if (eventCity && externalCity && eventCity !== externalCity) {
    return true;
  }

  return false;
}

export function candidateFixesSourceDefaultVenueMisapplication(
  candidate: CanonicalImportEvent,
  event: AdminEventRecord | null | undefined,
  context?: SourceDefaultVenueContext,
): boolean {
  if (!eventHasSourceDefaultVenueMisapplied(event, context)) {
    return false;
  }
  if (!isExternalLocationTitle(candidate.title)) {
    return false;
  }

  const candidateVenue = normalizeLabel(candidate.venueName);
  const defaultVenue = normalizeLabel(context?.defaultVenueName);
  if (candidateVenue && defaultVenue && candidateVenue !== defaultVenue) {
    return true;
  }

  const candidateCity = normalizeLabel(candidate.cityName);
  const defaultCity = normalizeLabel(context?.defaultCityName);
  if (candidateCity && defaultCity && candidateCity !== defaultCity) {
    return true;
  }

  return Boolean(
    (candidate.sourceMetadata as Record<string, unknown> | undefined)?.externalLocationFromTitle,
  );
}

function isSourceDefaultVenueLabel(
  venueName: string | undefined,
  context?: SourceDefaultVenueContext,
): boolean {
  const normalizedVenue = normalizeLabel(venueName);
  const defaultVenue = normalizeLabel(context?.defaultVenueName);
  return Boolean(normalizedVenue && defaultVenue && normalizedVenue === defaultVenue);
}

export function applyExplicitEventGeographyFields(
  existing: AdminEventRecord,
  candidate: CanonicalImportEvent,
): Partial<AdminEventRecord> {
  const metadata = candidate.sourceMetadata as Record<string, unknown> | undefined;
  const venueContext = readSourceDefaultVenueContext(metadata);
  const geography = metadata?.eventGeography as Record<string, unknown> | undefined;
  const externalFromMetadata = metadata?.externalLocationFromTitle === true;
  const externalFromTitle = isExternalLocationTitle(candidate.title);
  const hasExplicitVenue = geography?.venue === 'explicit' || externalFromMetadata || externalFromTitle;
  const hasExplicitCity = geography?.city === 'explicit' || externalFromMetadata || externalFromTitle;
  if (!hasExplicitVenue && !hasExplicitCity) {
    return {};
  }

  const patch: Partial<AdminEventRecord> = {};
  if (hasExplicitCity && candidate.cityName?.trim()) {
    patch.venueCity = candidate.cityName.trim();
  }

  const candidateVenue = candidate.venueName?.trim();
  const existingVenue = existing.venueName?.trim().toLowerCase();
  const venueChanged =
    candidateVenue !== undefined &&
    candidateVenue !== '' &&
    candidateVenue.toLowerCase() !== existingVenue;
  if (hasExplicitVenue && candidateVenue && !isSourceDefaultVenueLabel(candidateVenue, venueContext)) {
    patch.venueName = candidateVenue;
  } else if (eventHasSourceDefaultVenueMisapplied(existing, venueContext)) {
    patch.venueName = candidateVenue || undefined;
  }

  if (
    eventHasSourceDefaultVenueMisapplied(existing, venueContext) ||
    (hasExplicitVenue && venueChanged && existing.venueId) ||
    (hasExplicitCity &&
      candidate.cityName?.trim().toLowerCase() !== existing.venueCity?.trim().toLowerCase() &&
      existing.venueId)
  ) {
    patch.venueId = undefined;
  }

  return patch;
}
