/**
 * Germany-wide geography classification for ticket.io network discovery.
 * Uses venue/address/city evidence — not language alone.
 */

export type GeographyConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface GermanCityEntry {
  canonical: string;
  aliases: string[];
  bundesland: string;
  /** ISO 3166-2:DE code */
  stateCode: string;
}

export interface ShopGeographyClassification {
  country?: 'DE';
  bundesland?: string;
  stateCode?: string;
  city?: string;
  confidence: GeographyConfidence;
  evidenceSources: string[];
}

/** Major German cities with Bundesland mapping for ticket.io coverage measurement. */
export const GERMAN_CITY_REGISTRY: GermanCityEntry[] = [
  { canonical: 'Berlin', aliases: ['Berlin'], bundesland: 'Berlin', stateCode: 'DE-BE' },
  { canonical: 'Hamburg', aliases: ['Hamburg'], bundesland: 'Hamburg', stateCode: 'DE-HH' },
  { canonical: 'München', aliases: ['München', 'Munich', 'Muenchen'], bundesland: 'Bayern', stateCode: 'DE-BY' },
  { canonical: 'Köln', aliases: ['Köln', 'Cologne', 'Koeln'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Frankfurt am Main', aliases: ['Frankfurt am Main', 'Frankfurt'], bundesland: 'Hessen', stateCode: 'DE-HE' },
  { canonical: 'Stuttgart', aliases: ['Stuttgart'], bundesland: 'Baden-Württemberg', stateCode: 'DE-BW' },
  { canonical: 'Düsseldorf', aliases: ['Düsseldorf', 'Duesseldorf'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Leipzig', aliases: ['Leipzig'], bundesland: 'Sachsen', stateCode: 'DE-SN' },
  { canonical: 'Dortmund', aliases: ['Dortmund'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Essen', aliases: ['Essen'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Bremen', aliases: ['Bremen'], bundesland: 'Bremen', stateCode: 'DE-HB' },
  { canonical: 'Dresden', aliases: ['Dresden'], bundesland: 'Sachsen', stateCode: 'DE-SN' },
  { canonical: 'Hannover', aliases: ['Hannover'], bundesland: 'Niedersachsen', stateCode: 'DE-NI' },
  { canonical: 'Nürnberg', aliases: ['Nürnberg', 'Nuremberg', 'Nuernberg'], bundesland: 'Bayern', stateCode: 'DE-BY' },
  { canonical: 'Bonn', aliases: ['Bonn'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Mannheim', aliases: ['Mannheim'], bundesland: 'Baden-Württemberg', stateCode: 'DE-BW' },
  { canonical: 'Karlsruhe', aliases: ['Karlsruhe'], bundesland: 'Baden-Württemberg', stateCode: 'DE-BW' },
  { canonical: 'Münster', aliases: ['Münster', 'Muenster'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Bochum', aliases: ['Bochum'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Aachen', aliases: ['Aachen'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Oberhausen', aliases: ['Oberhausen'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Saarbrücken', aliases: ['Saarbrücken', 'Saarbruecken'], bundesland: 'Saarland', stateCode: 'DE-SL' },
  { canonical: 'Hagen', aliases: ['Hagen'], bundesland: 'Nordrhein-Westfalen', stateCode: 'DE-NW' },
  { canonical: 'Freiburg im Breisgau', aliases: ['Freiburg', 'Freiburg im Breisgau'], bundesland: 'Baden-Württemberg', stateCode: 'DE-BW' },
  { canonical: 'Kiel', aliases: ['Kiel'], bundesland: 'Schleswig-Holstein', stateCode: 'DE-SH' },
  { canonical: 'Rostock', aliases: ['Rostock'], bundesland: 'Mecklenburg-Vorpommern', stateCode: 'DE-MV' },
  { canonical: 'Magdeburg', aliases: ['Magdeburg'], bundesland: 'Sachsen-Anhalt', stateCode: 'DE-ST' },
  { canonical: 'Erfurt', aliases: ['Erfurt'], bundesland: 'Thüringen', stateCode: 'DE-TH' },
  { canonical: 'Mainz', aliases: ['Mainz'], bundesland: 'Rheinland-Pfalz', stateCode: 'DE-RP' },
  { canonical: 'Kassel', aliases: ['Kassel'], bundesland: 'Hessen', stateCode: 'DE-HE' },
  { canonical: 'Wiesbaden', aliases: ['Wiesbaden'], bundesland: 'Hessen', stateCode: 'DE-HE' },
  { canonical: 'Potsdam', aliases: ['Potsdam'], bundesland: 'Brandenburg', stateCode: 'DE-BB' },
  { canonical: 'Lübeck', aliases: ['Lübeck', 'Luebeck'], bundesland: 'Schleswig-Holstein', stateCode: 'DE-SH' },
  { canonical: 'Chemnitz', aliases: ['Chemnitz'], bundesland: 'Sachsen', stateCode: 'DE-SN' },
  { canonical: 'Palma', aliases: ['Palma', 'Palma de Mallorca'], bundesland: 'Non-DE', stateCode: 'NON-DE' },
];

const CITY_LOOKUP = new Map<string, GermanCityEntry>();
for (const entry of GERMAN_CITY_REGISTRY) {
  for (const alias of entry.aliases) {
    CITY_LOOKUP.set(alias.toLowerCase(), entry);
  }
}

const BUNDESLAND_SET = new Set(
  GERMAN_CITY_REGISTRY.filter((entry) => entry.stateCode !== 'NON-DE').map((entry) => entry.bundesland),
);

export function normalizeGermanCity(raw?: string): GermanCityEntry | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  const key = raw.trim();
  const direct = CITY_LOOKUP.get(key.toLowerCase());
  if (direct) {
    return direct;
  }
  for (const entry of GERMAN_CITY_REGISTRY) {
    for (const alias of entry.aliases) {
      if (new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i').test(key)) {
        return entry;
      }
    }
  }
  return undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function inferCityFromGermanText(...parts: Array<string | undefined>): string | undefined {
  const corpus = parts.filter(Boolean).join(' ');
  if (!corpus.trim()) {
    return undefined;
  }
  for (const entry of GERMAN_CITY_REGISTRY) {
    for (const alias of entry.aliases) {
      if (new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i').test(corpus)) {
        return entry.canonical;
      }
    }
  }
  return undefined;
}

export function bundeslandForCity(city?: string): { bundesland?: string; stateCode?: string } {
  const entry = normalizeGermanCity(city);
  if (!entry || entry.stateCode === 'NON-DE') {
    return {};
  }
  return { bundesland: entry.bundesland, stateCode: entry.stateCode };
}

export function classifyShopGeography(input: {
  seedCity?: string;
  seedRegion?: string;
  venueNames?: string[];
  eventCities?: string[];
  addresses?: string[];
  countryMetadata?: string;
}): ShopGeographyClassification {
  const evidenceSources: string[] = [];
  const cityCandidates: string[] = [];

  if (input.seedCity) {
    cityCandidates.push(input.seedCity);
    evidenceSources.push('seed_city');
  }
  for (const city of input.eventCities ?? []) {
    if (city) {
      cityCandidates.push(city);
      evidenceSources.push('event_city');
    }
  }
  for (const venue of input.venueNames ?? []) {
    const fromVenue = inferCityFromGermanText(venue);
    if (fromVenue) {
      cityCandidates.push(fromVenue);
      evidenceSources.push('venue_text');
    }
  }
  for (const address of input.addresses ?? []) {
    const fromAddress = inferCityFromGermanText(address);
    if (fromAddress) {
      cityCandidates.push(fromAddress);
      evidenceSources.push('structured_address');
    }
  }

  const countryMeta = (input.countryMetadata ?? '').toUpperCase();
  if (countryMeta === 'DE' || countryMeta === 'DEU' || countryMeta === 'GERMANY') {
    evidenceSources.push('country_metadata');
  }

  const resolvedCities = cityCandidates
    .map((city) => normalizeGermanCity(city))
    .filter((entry): entry is GermanCityEntry => Boolean(entry));

  const germanCities = resolvedCities.filter((entry) => entry.stateCode !== 'NON-DE');
  const nonGerman = resolvedCities.some((entry) => entry.stateCode === 'NON-DE');

  if (nonGerman && germanCities.length === 0) {
    return { country: undefined, confidence: 'LOW', evidenceSources: [...new Set(evidenceSources)] };
  }

  if (germanCities.length > 0) {
    const primary = germanCities[0]!;
    const multiCityEvidence = new Set(germanCities.map((entry) => entry.canonical)).size > 1;
    const confidence: GeographyConfidence =
      evidenceSources.includes('structured_address') || evidenceSources.includes('event_city')
        ? 'HIGH'
        : evidenceSources.includes('seed_city')
          ? multiCityEvidence
            ? 'MEDIUM'
            : 'HIGH'
          : 'MEDIUM';

    return {
      country: 'DE',
      bundesland: primary.bundesland,
      stateCode: primary.stateCode,
      city: primary.canonical,
      confidence,
      evidenceSources: [...new Set(evidenceSources)],
    };
  }

  if (input.seedRegion && BUNDESLAND_SET.has(input.seedRegion)) {
    return {
      country: 'DE',
      bundesland: input.seedRegion,
      confidence: 'LOW',
      evidenceSources: [...new Set([...evidenceSources, 'seed_region'])],
    };
  }

  return { confidence: 'UNKNOWN', evidenceSources: [...new Set(evidenceSources)] };
}

export function allBundeslaender(): string[] {
  return [...BUNDESLAND_SET].sort();
}

export function buildCoverageByState(
  entries: Array<{ bundesland?: string; shopCount: number; upcomingEvents: number; electronicCandidates: number; netNewCandidates: number }>,
): Record<string, { shops: number; upcomingEvents: number; electronicCandidates: number; netNewCandidates: number }> {
  const result: Record<string, { shops: number; upcomingEvents: number; electronicCandidates: number; netNewCandidates: number }> = {};
  for (const state of allBundeslaender()) {
    result[state] = { shops: 0, upcomingEvents: 0, electronicCandidates: 0, netNewCandidates: 0 };
  }
  for (const entry of entries) {
    const key = entry.bundesland ?? 'Unknown';
    if (!result[key]) {
      result[key] = { shops: 0, upcomingEvents: 0, electronicCandidates: 0, netNewCandidates: 0 };
    }
    result[key].shops += entry.shopCount;
    result[key].upcomingEvents += entry.upcomingEvents;
    result[key].electronicCandidates += entry.electronicCandidates;
    result[key].netNewCandidates += entry.netNewCandidates;
  }
  return result;
}

export function identifyCoverageGaps(
  coverageByState: Record<string, { shops: number; upcomingEvents: number }>,
): Array<{ bundesland: string; gapType: string; detail: string }> {
  const gaps: Array<{ bundesland: string; gapType: string; detail: string }> = [];
  for (const state of allBundeslaender()) {
    const coverage = coverageByState[state];
    if (!coverage || coverage.shops === 0) {
      gaps.push({
        bundesland: state,
        gapType: 'zero_shops',
        detail: `No ticket.io shops discovered in ${state}`,
      });
    }
  }
  const majorElectronicCities = ['Berlin', 'Hamburg', 'München', 'Leipzig', 'Frankfurt am Main'];
  return gaps;
}
