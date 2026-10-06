import { bundeslandForCity } from './germany-geography';
import type { EnrichedTicketIoEvent } from './detail-types';

export interface ControlledBatchSelectionOptions {
  /** Target batch size (default 15, range 10–20). */
  targetSize?: number;
  minSize?: number;
  maxSize?: number;
}

export interface ControlledBatchSelectionResult {
  selected: EnrichedTicketIoEvent[];
  selectionReasons: Array<{
    identityKey: string;
    title: string;
    shopSlug: string;
    city?: string;
    bundesland?: string;
    importReadinessScore: number;
    diversityFactors: string[];
  }>;
  skippedDueToDiversity: number;
  candidatesConsidered: number;
}

/**
 * Select a quality-ranked controlled import batch with geographic and shop diversity.
 * Does NOT select by URL order — uses importReadinessScore with diversity penalties.
 */
export function selectControlledImportBatch(
  events: EnrichedTicketIoEvent[],
  options: ControlledBatchSelectionOptions = {},
): ControlledBatchSelectionResult {
  const targetSize = options.targetSize ?? 15;
  const minSize = options.minSize ?? 10;
  const maxSize = options.maxSize ?? 20;
  const effectiveTarget = Math.min(maxSize, Math.max(minSize, targetSize));

  const importCandidates = events
    .filter((event) => event.qualification === 'IMPORT_CANDIDATE')
    .sort((left, right) => (right.importReadinessScore ?? 0) - (left.importReadinessScore ?? 0));

  const selected: EnrichedTicketIoEvent[] = [];
  const usedShops = new Set<string>();
  const usedCities = new Set<string>();
  const usedBundeslaender = new Set<string>();
  const usedGenres = new Set<string>();
  const selectionReasons: ControlledBatchSelectionResult['selectionReasons'] = [];
  let skippedDueToDiversity = 0;

  for (const candidate of importCandidates) {
    if (selected.length >= effectiveTarget) {
      break;
    }

    const shopKey = candidate.shopSlug;
    const cityKey = candidate.city ?? 'unknown';
    const bundesland = bundeslandForCity(candidate.city).bundesland ?? 'unknown';
    const genreKey =
      candidate.genreCandidates.find((genre) => genre.confidence !== 'weak_inferred')?.label ??
      candidate.genreCandidates[0]?.label ??
      'unknown';

    const diversityPenalty =
      (usedShops.has(shopKey) ? 2 : 0) +
      (usedCities.has(cityKey) ? 1 : 0) +
      (usedBundeslaender.has(bundesland) ? 1 : 0) +
      (usedGenres.has(genreKey) ? 1 : 0);

    const minBatchBeforeStrictDiversity = Math.min(5, effectiveTarget);
    const acceptDespiteDiversity = selected.length < minBatchBeforeStrictDiversity && diversityPenalty < 4;

    if (diversityPenalty >= 4 && !acceptDespiteDiversity) {
      skippedDueToDiversity += 1;
      continue;
    }

    const diversityFactors: string[] = [];
    if (!usedShops.has(shopKey)) diversityFactors.push('new_shop');
    if (!usedCities.has(cityKey)) diversityFactors.push('new_city');
    if (!usedBundeslaender.has(bundesland)) diversityFactors.push('new_bundesland');
    if (!usedGenres.has(genreKey)) diversityFactors.push('new_genre');

    selected.push(candidate);
    usedShops.add(shopKey);
    usedCities.add(cityKey);
    usedBundeslaender.add(bundesland);
    usedGenres.add(genreKey);

    selectionReasons.push({
      identityKey: candidate.identityKey,
      title: candidate.title,
      shopSlug: candidate.shopSlug,
      city: candidate.city,
      bundesland,
      importReadinessScore: candidate.importReadinessScore ?? 0,
      diversityFactors,
    });
  }

  if (selected.length < minSize) {
    for (const candidate of importCandidates) {
      if (selected.length >= minSize) {
        break;
      }
      if (!selected.some((entry) => entry.identityKey === candidate.identityKey)) {
        selected.push(candidate);
        selectionReasons.push({
          identityKey: candidate.identityKey,
          title: candidate.title,
          shopSlug: candidate.shopSlug,
          city: candidate.city,
          bundesland: bundeslandForCity(candidate.city).bundesland,
          importReadinessScore: candidate.importReadinessScore ?? 0,
          diversityFactors: ['diversity_fallback'],
        });
      }
    }
  }

  return {
    selected: selected.slice(0, maxSize),
    selectionReasons,
    skippedDueToDiversity,
    candidatesConsidered: importCandidates.length,
  };
}
