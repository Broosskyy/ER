/**
 * Extracts off-site venue/city hints from event titles (e.g. Bootshaus external gigs).
 * Example: "122 pres. ARTIST @ Palma de Mallorca (ES)"
 */
export interface ExternalLocationFromTitle {
  venueName?: string;
  cityName: string;
  countryCode?: string;
}

const TITLE_AT_LOCATION =
  /@\s*(.+?)(?:\s*\(([A-Z]{2})\))?\s*$/i;

const TITLE_AT_VENUE_CITY =
  /@\s*([^,@(]+?)(?:\s*[,@]\s*|\s+in\s+)([^@(]+?)(?:\s*\(([A-Z]{2})\))?\s*$/i;

export function extractExternalLocationFromTitle(
  title: string | undefined,
): ExternalLocationFromTitle | undefined {
  const trimmed = title?.trim();
  if (!trimmed || !trimmed.includes('@')) {
    return undefined;
  }

  const venueCityMatch = trimmed.match(TITLE_AT_VENUE_CITY);
  if (venueCityMatch) {
    const venueName = venueCityMatch[1]?.trim();
    const cityName = venueCityMatch[2]?.trim();
    const countryCode = venueCityMatch[3]?.trim();
    if (cityName) {
      return {
        venueName: venueName || undefined,
        cityName,
        countryCode,
      };
    }
  }

  const locationMatch = trimmed.match(TITLE_AT_LOCATION);
  if (!locationMatch?.[1]) {
    return undefined;
  }

  const location = locationMatch[1].trim();
  const countryCode = locationMatch[2]?.trim();

  return {
    cityName: location,
    countryCode,
  };
}

export function isExternalLocationTitle(title: string | undefined): boolean {
  return extractExternalLocationFromTitle(title) !== undefined;
}
