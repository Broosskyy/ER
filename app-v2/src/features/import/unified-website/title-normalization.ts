import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

export interface TitleNormalizationResult {
  rawTitle: string;
  normalizedTitle: string;
  suffixRemoved: boolean;
  removedSuffix?: string;
}

const DEFAULT_SUFFIX_PATTERNS = [
  /\s*[|–—-]\s*[^|–—-]+$/,
];

/**
 * Normalize official page titles by removing provider-configured site suffixes.
 * Preserves legitimate titles where the provider name is part of the event name.
 */
export function normalizeOfficialPageTitle(
  rawTitle: string,
  suffixPatterns: RegExp[] = DEFAULT_SUFFIX_PATTERNS,
): TitleNormalizationResult {
  const decoded = decodeHtmlEntities(rawTitle).replace(/\s+/g, ' ').trim();
  if (!decoded) {
    return { rawTitle: rawTitle.trim(), normalizedTitle: rawTitle.trim(), suffixRemoved: false };
  }

  for (const pattern of suffixPatterns) {
    const match = decoded.match(pattern);
    if (!match) continue;
    const normalized = decoded.replace(pattern, '').trim();
    if (normalized.length >= 3) {
      return {
        rawTitle: decoded,
        normalizedTitle: normalized,
        suffixRemoved: true,
        removedSuffix: match[0].trim(),
      };
    }
  }

  return { rawTitle: decoded, normalizedTitle: decoded, suffixRemoved: false };
}
