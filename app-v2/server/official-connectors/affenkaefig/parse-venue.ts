export function parseAffenkaefigVenueBlock(
  locationLabel: string,
  addressLine?: string,
): {
  name: string;
  address?: string;
  postalCode?: string;
  city?: string;
  countryCode: string;
} {
  const [venueName, cityFromLabel] = locationLabel.split('·').map((part) => part.trim());
  const addressMatch = addressLine?.match(/^(.*?),?\s*(\d{5})\s+(.+)$/);

  return {
    name: venueName || locationLabel.trim(),
    address: addressMatch?.[1]?.trim() || addressLine?.trim() || undefined,
    postalCode: addressMatch?.[2],
    city: cityFromLabel || addressMatch?.[3]?.trim(),
    countryCode: 'DE',
  };
}
