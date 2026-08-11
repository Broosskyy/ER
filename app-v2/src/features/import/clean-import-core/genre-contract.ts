import {
  normalizeCanonicalGenreLabel,
  normalizeCanonicalGenreLabels,
} from '@/features/events/formatting/canonical-genre-normalizer';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

export type GenreConfidence = 'high' | 'medium' | 'low' | 'uncertain';

export interface GenreEvidenceItem {
  rawValue: string;
  normalizedLabel: string;
  sourceId: string;
  sourceUrl?: string;
  confidence: GenreConfidence;
  uncertain: boolean;
  confirmed?: boolean;
}

export interface GenreContractResult {
  items: GenreEvidenceItem[];
  normalizedLabels: string[];
  rawValues: string[];
  uncertainLabels: string[];
  /** True when incoming weaker evidence was blocked from overwriting confirmed genres. */
  preservedConfirmed: boolean;
  /** Chip/multi-select suggestions for admin quick enrichment. */
  chipSuggestions: string[];
}

const KNOWN_CANONICAL_LABELS = [
  'Techno',
  'Hard Techno',
  'House',
  'Trance',
  'Psy',
  'Industrial',
  'DnB',
  'Tech House',
  'Melodic Techno',
  'Deep House',
  'Hardstyle',
] as const;

function confidenceFor(input: {
  kind?: string;
  sourceFamily?: string;
  uncertainMapping: boolean;
}): GenreConfidence {
  if (input.uncertainMapping) return 'uncertain';
  if (input.kind === 'admin_url' || input.kind === 'organizer_manual') return 'high';
  if (input.sourceFamily === 'official_website') return 'high';
  if (input.kind === 'automatic_source') return 'medium';
  if (input.kind === 'community_manual') return 'low';
  return 'medium';
}

function strength(confidence: GenreConfidence): number {
  switch (confidence) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    case 'uncertain':
      return 0;
  }
}

function isKnownCanonical(label: string): boolean {
  const key = normalizeMatchText(label);
  return KNOWN_CANONICAL_LABELS.some((entry) => normalizeMatchText(entry) === key);
}

/**
 * Genre contract for drafts/review cards.
 * - Multi-genre
 * - Preserve raw source values
 * - Normalize Eternal Rave labels (Tech House / Tech-House / Techhouse → Tech House)
 * - Never derive genres from venue/organizer alone
 * - Never overwrite confirmed genres with weaker evidence
 */
export function resolveGenreContract(input: {
  rawGenres?: string[];
  sourceId: string;
  sourceUrl?: string;
  sourceFamily?: string;
  submissionKind?: string;
  existingConfirmedGenres?: string[];
}): GenreContractResult {
  const rawValues = (input.rawGenres ?? []).map((value) => value.trim()).filter(Boolean);
  const existingConfirmed = normalizeCanonicalGenreLabels(input.existingConfirmedGenres);
  const confirmedKeys = new Set(existingConfirmed.map((label) => normalizeMatchText(label)));

  const incoming: GenreEvidenceItem[] = rawValues.map((rawValue) => {
    const normalizedLabel = normalizeCanonicalGenreLabel(rawValue);
    const uncertain = !isKnownCanonical(normalizedLabel);
    return {
      rawValue,
      normalizedLabel,
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      confidence: confidenceFor({
        kind: input.submissionKind,
        sourceFamily: input.sourceFamily,
        uncertainMapping: uncertain,
      }),
      uncertain,
      confirmed: false,
    };
  });

  const byKey = new Map<string, GenreEvidenceItem>();
  for (const label of existingConfirmed) {
    byKey.set(normalizeMatchText(label), {
      rawValue: label,
      normalizedLabel: label,
      sourceId: 'confirmed',
      confidence: 'high',
      uncertain: false,
      confirmed: true,
    });
  }

  let preservedConfirmed = false;
  for (const item of incoming) {
    const key = normalizeMatchText(item.normalizedLabel);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }
    if (existing.confirmed && strength(item.confidence) < strength('high')) {
      preservedConfirmed = true;
      continue;
    }
    if (strength(item.confidence) >= strength(existing.confidence)) {
      byKey.set(key, { ...item, confirmed: existing.confirmed });
    }
  }

  const incomingMax = incoming.reduce((max, item) => Math.max(max, strength(item.confidence)), -1);
  if (existingConfirmed.length > 0 && incomingMax >= 0 && incomingMax < strength('high')) {
    preservedConfirmed = true;
    const confirmedOnly = existingConfirmed.map((label) => ({
      rawValue: label,
      normalizedLabel: label,
      sourceId: 'confirmed',
      confidence: 'high' as const,
      uncertain: false,
      confirmed: true,
    }));
    const additive = [...byKey.values()].filter(
      (item) => !item.confirmed && !confirmedKeys.has(normalizeMatchText(item.normalizedLabel)),
    );
    const items = [...confirmedOnly, ...additive];
    const normalizedLabels = normalizeCanonicalGenreLabels(
      items.map((item) => item.normalizedLabel),
    );
    return {
      items,
      normalizedLabels,
      rawValues,
      uncertainLabels: items.filter((item) => item.uncertain).map((item) => item.normalizedLabel),
      preservedConfirmed,
      chipSuggestions: normalizedLabels,
    };
  }

  const items = [...byKey.values()];
  const normalizedLabels = normalizeCanonicalGenreLabels(items.map((item) => item.normalizedLabel));
  return {
    items,
    normalizedLabels,
    rawValues,
    uncertainLabels: items.filter((item) => item.uncertain).map((item) => item.normalizedLabel),
    preservedConfirmed,
    chipSuggestions: normalizedLabels,
  };
}
