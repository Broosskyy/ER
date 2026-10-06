import { normalizeDiscoverySearchText } from '@/features/discovery/search/discovery-search-normalizer';

const CITY_ALIASES: Record<string, string[]> = {
  koeln: ['koln', 'cologne', 'köln'],
  berlin: ['berlin'],
  stuttgart: ['stuttgart'],
  leipzig: ['leipzig'],
  hamburg: ['hamburg'],
  muenchen: ['munchen', 'munich', 'münchen'],
};

function canonicalCityKey(value: string): string {
  return normalizeDiscoverySearchText(value, 'de');
}

function expandCityAliases(city: string): Set<string> {
  const normalized = canonicalCityKey(city);
  const aliases = new Set<string>([normalized]);

  for (const [canonical, values] of Object.entries(CITY_ALIASES)) {
    if (canonical === normalized || values.includes(normalized)) {
      aliases.add(canonical);
      for (const alias of values) {
        aliases.add(alias);
      }
    }
  }

  return aliases;
}

/** Accent-insensitive city equality with common German alias support. */
export function discoveryCitiesMatch(left: string, right: string): boolean {
  if (!left.trim() || !right.trim()) {
    return false;
  }

  const leftAliases = expandCityAliases(left);
  const rightKey = canonicalCityKey(right);
  return leftAliases.has(rightKey);
}
