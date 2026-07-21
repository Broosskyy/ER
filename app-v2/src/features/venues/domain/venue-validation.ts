import { AppError } from '@/core/errors/app-error';
import { isValidVenueSlug } from '@/features/venues/domain/venue-slug';
import { validateUrl } from '@/features/import/normalization/url-normalizer';

const MAX_NAME_LENGTH = 160;
const MAX_SLUG_LENGTH = 180;
const MAX_STREET_LENGTH = 200;
const MAX_HOUSE_NUMBER_LENGTH = 32;
const MAX_POSTAL_CODE_LENGTH = 24;
const MAX_CITY_LENGTH = 120;
const MAX_STATE_LENGTH = 120;
const MAX_COUNTRY_LENGTH = 120;
const MAX_NOTES_LENGTH = 4000;
const MAX_CAPACITY = 500_000;

export interface VenueValidationInput {
  name: string;
  slug?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  capacity?: number;
  notes?: string;
}

export function normalizeOptionalString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeVenueName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeVenueUrlField(value: string | undefined): string | undefined {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return undefined;
  }

  const result = validateUrl(normalized);
  if (!result.valid || !result.url) {
    throw new AppError(`Invalid URL: ${normalized}`, { code: 'VALIDATION' });
  }

  return result.url;
}

export function validateVenueCoordinates(
  latitude: number | undefined,
  longitude: number | undefined,
): { latitude?: number; longitude?: number } {
  if (latitude === undefined && longitude === undefined) {
    return {};
  }

  if (latitude === undefined || longitude === undefined) {
    throw new AppError('Latitude and longitude must both be provided.', { code: 'VALIDATION' });
  }

  if (latitude < -90 || latitude > 90) {
    throw new AppError('Latitude must be between -90 and 90.', { code: 'VALIDATION' });
  }

  if (longitude < -180 || longitude > 180) {
    throw new AppError('Longitude must be between -180 and 180.', { code: 'VALIDATION' });
  }

  return { latitude, longitude };
}

export function validateVenueInput(input: VenueValidationInput): {
  name: string;
  slug?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  website?: string;
  capacity?: number;
  notes?: string;
} {
  const name = normalizeVenueName(input.name);
  if (!name) {
    throw new AppError('Venue name is required.', { code: 'VALIDATION' });
  }
  if (name.length > MAX_NAME_LENGTH) {
    throw new AppError(`Venue name must be at most ${MAX_NAME_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const slug = normalizeOptionalString(input.slug);
  if (slug && (slug.length > MAX_SLUG_LENGTH || !isValidVenueSlug(slug))) {
    throw new AppError('Venue slug must use lowercase letters, numbers, and hyphens.', {
      code: 'VALIDATION',
    });
  }

  const city = normalizeOptionalString(input.city);
  if (!city) {
    throw new AppError('City is required.', { code: 'VALIDATION' });
  }
  if (city.length > MAX_CITY_LENGTH) {
    throw new AppError(`City must be at most ${MAX_CITY_LENGTH} characters.`, { code: 'VALIDATION' });
  }

  const country = normalizeOptionalString(input.country);
  if (!country) {
    throw new AppError('Country is required.', { code: 'VALIDATION' });
  }
  if (country.length > MAX_COUNTRY_LENGTH) {
    throw new AppError(`Country must be at most ${MAX_COUNTRY_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const street = normalizeOptionalString(input.street);
  if (street && street.length > MAX_STREET_LENGTH) {
    throw new AppError(`Street must be at most ${MAX_STREET_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const houseNumber = normalizeOptionalString(input.houseNumber);
  if (houseNumber && houseNumber.length > MAX_HOUSE_NUMBER_LENGTH) {
    throw new AppError(`House number must be at most ${MAX_HOUSE_NUMBER_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const postalCode = normalizeOptionalString(input.postalCode);
  if (postalCode && postalCode.length > MAX_POSTAL_CODE_LENGTH) {
    throw new AppError(`Postal code must be at most ${MAX_POSTAL_CODE_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const state = normalizeOptionalString(input.state);
  if (state && state.length > MAX_STATE_LENGTH) {
    throw new AppError(`State must be at most ${MAX_STATE_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  const notes = normalizeOptionalString(input.notes);
  if (notes && notes.length > MAX_NOTES_LENGTH) {
    throw new AppError(`Notes must be at most ${MAX_NOTES_LENGTH} characters.`, {
      code: 'VALIDATION',
    });
  }

  if (input.capacity !== undefined) {
    if (!Number.isInteger(input.capacity) || input.capacity < 0 || input.capacity > MAX_CAPACITY) {
      throw new AppError(`Capacity must be an integer between 0 and ${MAX_CAPACITY}.`, {
        code: 'VALIDATION',
      });
    }
  }

  const coordinates = validateVenueCoordinates(input.latitude, input.longitude);

  return {
    name,
    slug,
    street,
    houseNumber,
    postalCode,
    city,
    state,
    country,
    ...coordinates,
    website: normalizeVenueUrlField(input.website),
    capacity: input.capacity,
    notes,
  };
}

export function normalizeVenueNameForComparison(name: string): string {
  return normalizeVenueName(name).toLowerCase();
}

export function normalizeVenueAddressKey(input: {
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city: string;
  country: string;
}): string {
  return [
    input.street ?? '',
    input.houseNumber ?? '',
    input.postalCode ?? '',
    input.city,
    input.country,
  ]
    .map((part) => part.trim().toLowerCase())
    .join('|');
}
