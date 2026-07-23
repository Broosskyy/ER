import type { SourceRecord } from '@/data/types/records';

export interface SourceDuplicateCandidate {
  source: SourceRecord;
  reason: 'slug' | 'base_url';
}

function normalizeUrlForComparison(url: string | undefined): string | null {
  if (!url?.trim()) {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    const pathname = parsed.pathname.replace(/\/$/, '');
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${pathname}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function findSourceDuplicateCandidates(
  input: { slug?: string; baseUrl?: string },
  sources: SourceRecord[],
  excludeId?: string,
): SourceDuplicateCandidate[] {
  const candidates: SourceDuplicateCandidate[] = [];
  const slug = input.slug?.trim().toLowerCase();
  const baseUrl = normalizeUrlForComparison(input.baseUrl);

  for (const source of sources) {
    if (excludeId && source.id === excludeId) {
      continue;
    }

    if (slug && source.slug.toLowerCase() === slug) {
      candidates.push({ source, reason: 'slug' });
      continue;
    }

    const existingUrl = normalizeUrlForComparison(source.baseUrl);
    if (baseUrl && existingUrl && baseUrl === existingUrl) {
      candidates.push({ source, reason: 'base_url' });
    }
  }

  return candidates;
}

export function findStrongSourceDuplicate(
  input: { slug?: string; baseUrl?: string },
  sources: SourceRecord[],
  excludeId?: string,
): SourceDuplicateCandidate | null {
  const slug = input.slug?.trim().toLowerCase();
  if (slug) {
    const slugMatch = findSourceDuplicateCandidates(input, sources, excludeId).find(
      (candidate) => candidate.reason === 'slug',
    );
    if (slugMatch) {
      return slugMatch;
    }
  }

  const urlMatch = findSourceDuplicateCandidates(input, sources, excludeId).find(
    (candidate) => candidate.reason === 'base_url',
  );
  return urlMatch ?? null;
}
