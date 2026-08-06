import type { SourceRecord } from '@/data/types/records';
import type { ImportSourceConfig, SourceFieldDefaults } from '@/features/import/models/source-config';
import type { NormalizedEventCandidate } from '@/features/import/models/normalized-event-candidate';
import {
  extractExternalLocationFromTitle,
  isExternalLocationTitle,
} from '@/features/import/normalization/external-location-from-title';
import { isMeaningfulEventText } from '@/features/events/domain/event-field-value';

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

function isSourceDefaultVenueLabel(
  venueName: string | undefined,
  defaults: SourceFieldDefaults,
): boolean {
  const candidate = venueName?.trim().toLowerCase();
  if (!candidate) {
    return false;
  }

  const defaultsToCheck = [defaults.venueName, defaults.organizerName]
    .filter((value): value is string => Boolean(value?.trim()))
    .map((value) => value.trim().toLowerCase());

  return defaultsToCheck.some(
    (defaultLabel) => candidate === defaultLabel || candidate === `${defaultLabel} köln`,
  );
}

function resolveExternalLocationVenueName(
  candidateVenueName: string | undefined,
  externalVenueName: string | undefined,
  defaults: SourceFieldDefaults,
): string | undefined {
  if (externalVenueName?.trim()) {
    return externalVenueName.trim();
  }

  const scrapedVenue = candidateVenueName?.trim();
  if (scrapedVenue && !isSourceDefaultVenueLabel(scrapedVenue, defaults)) {
    return scrapedVenue;
  }

  return undefined;
}

export function applySourceFieldDefaults<T extends NormalizedEventCandidate>(
  candidate: T,
  defaults: SourceFieldDefaults,
): T {
  const externalLocation = extractExternalLocationFromTitle(candidate.title);
  const hasExternalLocation = isExternalLocationTitle(candidate.title);
  const hadExplicitVenue = isMeaningfulEventText(candidate.venueName);
  const hadExplicitCity = isMeaningfulEventText(candidate.cityName);
  const hadExplicitAddress = isMeaningfulEventText(candidate.venueAddress);
  const hadExplicitCountry = isMeaningfulEventText(candidate.countryCode);

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

  const cityName = hasExternalLocation
    ? externalLocation?.cityName ?? candidate.cityName
    : isBlank(candidate.cityName)
      ? defaults.cityName
      : candidate.cityName;

  const venueName = hasExternalLocation
    ? resolveExternalLocationVenueName(candidate.venueName, externalLocation?.venueName, defaults)
    : isBlank(candidate.venueName)
      ? defaults.venueName
      : candidate.venueName;

  const countryCode = hasExternalLocation
    ? externalLocation?.countryCode ?? candidate.countryCode
    : isBlank(candidate.countryCode)
      ? defaults.countryCode
      : candidate.countryCode;

  return {
    ...candidate,
    cityName,
    venueName: isBlank(venueName) && hasExternalLocation ? undefined : venueName,
    organizerName: isBlank(candidate.organizerName) ? defaults.organizerName : candidate.organizerName,
    countryCode,
    venueAddress: venueAddress ?? candidate.venueAddress,
    ticketUrl: isBlank(ticketUrl) ? candidate.ticketUrl : ticketUrl,
    sourceMetadata: {
      ...(candidate.sourceMetadata ?? {}),
      ...(defaults.cityId && !hasExternalLocation ? { defaultCityId: defaults.cityId } : {}),
      ...(defaults.venueId && !hasExternalLocation ? { defaultVenueId: defaults.venueId } : {}),
      ...(defaults.organizerId ? { defaultOrganizerId: defaults.organizerId } : {}),
      ...(hasExternalLocation
        ? {
            externalLocationFromTitle: true,
            externalLocationCity: externalLocation?.cityName,
            externalLocationVenue: externalLocation?.venueName,
            externalLocationCountry: externalLocation?.countryCode,
          }
        : {}),
      eventGeography: {
        venue: hasExternalLocation || hadExplicitVenue ? 'explicit' : 'source_default',
        city: hasExternalLocation || hadExplicitCity ? 'explicit' : 'source_default',
        address: hadExplicitAddress ? 'explicit' : 'source_default',
        country: hasExternalLocation || hadExplicitCountry ? 'explicit' : 'source_default',
      },
      ...(candidate.imageUrl
        ? {
            posterMetadata:
              (candidate.sourceMetadata?.posterMetadata as Record<string, unknown> | undefined) ?? {
                source: 'poster_ocr',
                status: 'pending',
              },
          }
        : {}),
    },
  };
}
