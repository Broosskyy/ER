export interface AddressValidityInput {
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AddressValidity {
  streetAddress?: string;
  cityLabel?: string;
  venueLabel?: string;
  hasCoordinates: boolean;
  hasRealStreetAddress: boolean;
  canOpenDirections: boolean;
}

function normalize(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function looksLikeStreetAddress(address: string, venueName?: string, city?: string): boolean {
  const normalized = address.toLowerCase();
  if (venueName && normalized === venueName.trim().toLowerCase()) {
    return false;
  }
  if (city && normalized === city.trim().toLowerCase()) {
    return false;
  }
  // Require a digit (house number) or common street token.
  return /\d/.test(address) || /\b(str(asse)?|street|weg|platz|allee|gasse)\b/i.test(address);
}

export function resolveAddressValidity(input: AddressValidityInput): AddressValidity {
  const venueLabel = normalize(input.venueName);
  const cityLabel = normalize(input.city);
  const rawAddress = normalize(input.address);
  const hasCoordinates =
    typeof input.latitude === 'number' &&
    Number.isFinite(input.latitude) &&
    typeof input.longitude === 'number' &&
    Number.isFinite(input.longitude);

  const hasRealStreetAddress = Boolean(
    rawAddress && looksLikeStreetAddress(rawAddress, venueLabel, cityLabel),
  );

  return {
    venueLabel,
    cityLabel,
    streetAddress: hasRealStreetAddress ? rawAddress : undefined,
    hasCoordinates,
    hasRealStreetAddress,
    canOpenDirections: hasCoordinates || hasRealStreetAddress,
  };
}
