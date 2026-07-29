import type { SourceRecord } from '@/data/types/records';
import type { ImportSourceConfig, SourceFieldDefaults } from '@/features/import/models/source-config';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';

function isBlank(value: string | undefined | null): boolean {
  return value == null || value.trim() === '';
}

export function resolveSourceFieldDefaults(
  sourceConfig?: ImportSourceConfig | null,
  sourceRecord?: Pick<
    SourceRecord,
    'city' | 'venueName' | 'organizerName' | 'countryCode' | 'sourceConfig'
  > | null,
): SourceFieldDefaults {
  const configDefaults = sourceConfig?.defaults ?? {};
  const record = sourceRecord ?? null;

  return {
    cityName: configDefaults.cityName ?? record?.city,
    cityId: configDefaults.cityId,
    venueName: configDefaults.venueName ?? record?.venueName,
    venueId: configDefaults.venueId,
    organizerName: configDefaults.organizerName ?? record?.organizerName,
    organizerId: configDefaults.organizerId,
    countryCode:
      configDefaults.countryCode ??
      sourceConfig?.regional?.countryCode ??
      record?.countryCode,
    address: configDefaults.address,
    postalCode: configDefaults.postalCode,
    venueAddress: configDefaults.venueAddress,
    ticketUrlFallback: configDefaults.ticketUrlFallback,
  };
}

export function applySourceFieldDefaults<T extends NormalizedEventCandidate>(
  candidate: T,
  defaults: SourceFieldDefaults,
): T {
  const venueAddress =
    candidate.venueAddress?.trim() ||
    defaults.venueAddress ||
    [defaults.address, defaults.postalCode, defaults.cityName]
      .filter((part) => part && part.trim())
      .join(', ') ||
    undefined;

  let ticketUrl = candidate.ticketUrl;
  if (isBlank(ticketUrl) && defaults.ticketUrlFallback === 'eventUrl') {
    ticketUrl = candidate.eventUrl ?? candidate.originalLink ?? candidate.sourceUrl;
  }

  return {
    ...candidate,
    cityName: isBlank(candidate.cityName) ? defaults.cityName : candidate.cityName,
    venueName: isBlank(candidate.venueName) ? defaults.venueName : candidate.venueName,
    organizerName: isBlank(candidate.organizerName) ? defaults.organizerName : candidate.organizerName,
    countryCode: isBlank(candidate.countryCode) ? defaults.countryCode : candidate.countryCode,
    venueAddress: venueAddress ?? candidate.venueAddress,
    ticketUrl: isBlank(ticketUrl) ? candidate.ticketUrl : ticketUrl,
    sourceMetadata: {
      ...(candidate.sourceMetadata ?? {}),
      ...(defaults.cityId ? { defaultCityId: defaults.cityId } : {}),
      ...(defaults.venueId ? { defaultVenueId: defaults.venueId } : {}),
      ...(defaults.organizerId ? { defaultOrganizerId: defaults.organizerId } : {}),
    },
  };
}
