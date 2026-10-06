import type { EnrichedTicketIoEvent } from '../ticket-evidence/network-discovery/detail-types';
import type { ImportQualityContractResult } from '../ticket-evidence/network-discovery/import-quality-contract-gate';
import { bundeslandForCity } from '../ticket-evidence/network-discovery/germany-geography';
import { passesImportEligibilityFromSnapshot } from './import-eligibility';

export interface M94EQualityPoolEntry {
  event: EnrichedTicketIoEvent;
  contract?: ImportQualityContractResult;
  qualityContract?: ImportQualityContractResult;
}

export interface M94ECohortEntry {
  identityKey: string;
  title: string;
  startsAt?: string;
  city?: string;
  regionSlug: string;
  bundesland?: string;
  sourceUrl: string;
  relevance: string;
  domainState: string;
  genres: string[];
  primaryGenre: string;
  lineupCount: number;
  ticketUrl?: string;
  mediaUrl?: string;
  matchClassification: string;
  qualification: string;
  importReadinessScore: number;
  locationOnly: boolean;
}

export interface M94ECohortSelection {
  targetSize: number;
  eligibleSnapshotPool: number;
  eligibleAfterExclusions: number;
  excludedPreviousCohort: number;
  locationOnlyAvailable: number;
  locationOnlyTarget: number;
  entries: M94ECohortEntry[];
}

function contractFor(entry: M94EQualityPoolEntry): ImportQualityContractResult | undefined {
  return entry.contract ?? entry.qualityContract;
}

function snapshotEligible(entry: M94EQualityPoolEntry): boolean {
  const contract = contractFor(entry);
  return Boolean(
    contract &&
      !contract.qualityContractBypass &&
      entry.event.lifecycle !== 'ENDED' &&
      passesImportEligibilityFromSnapshot(
        entry.event.relevance,
        contract.domainState,
        contract.passesQualityContract,
      ),
  );
}

function primaryGenre(event: EnrichedTicketIoEvent): string {
  return (
    event.genreCandidates.find((candidate) => candidate.confidence !== 'weak_inferred')?.label ??
    event.genreCandidates[0]?.label ??
    'unknown'
  );
}

function startRank(value?: string): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stableBaseOrder(
  left: M94EQualityPoolEntry,
  right: M94EQualityPoolEntry,
): number {
  const readiness =
    (right.event.importReadinessScore ?? 0) - (left.event.importReadinessScore ?? 0);
  if (readiness !== 0) return readiness;

  const relevance =
    (right.event.relevance === 'HIGH_RELEVANCE' ? 2 : 1) -
    (left.event.relevance === 'HIGH_RELEVANCE' ? 2 : 1);
  if (relevance !== 0) return relevance;

  const date = startRank(right.event.startsAt) - startRank(left.event.startsAt);
  if (date !== 0) return date;

  return left.event.identityKey.localeCompare(right.event.identityKey);
}

function toCohortEntry(
  entry: M94EQualityPoolEntry,
  locationOnlySlugs: Set<string>,
): M94ECohortEntry {
  const contract = contractFor(entry);
  if (!contract) {
    throw new Error(`m94e_missing_quality_contract:${entry.event.identityKey}`);
  }

  return {
    identityKey: entry.event.identityKey,
    title: entry.event.title,
    startsAt: entry.event.startsAt,
    city: entry.event.city,
    regionSlug: entry.event.shopSlug,
    bundesland: bundeslandForCity(entry.event.city).bundesland,
    sourceUrl: entry.event.canonicalUrl,
    relevance: entry.event.relevance,
    domainState: contract.domainState,
    genres: entry.event.genreCandidates.map((genre) => genre.label),
    primaryGenre: primaryGenre(entry.event),
    lineupCount: entry.event.lineupHints.length,
    ticketUrl: entry.event.eventUrl,
    mediaUrl: entry.event.bestMediaUrl,
    matchClassification: entry.event.matchClassification,
    qualification: entry.event.qualification,
    importReadinessScore: entry.event.importReadinessScore ?? 0,
    locationOnly: locationOnlySlugs.has(entry.event.ticketIoEventId),
  };
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function selectDiverse(
  pool: M94EQualityPoolEntry[],
  count: number,
  selectedKeys: Set<string>,
  cityCounts: Map<string, number>,
  regionCounts: Map<string, number>,
  genreCounts: Map<string, number>,
): M94EQualityPoolEntry[] {
  const available = pool
    .filter((entry) => !selectedKeys.has(entry.event.identityKey))
    .sort(stableBaseOrder);
  const picked: M94EQualityPoolEntry[] = [];

  while (picked.length < count && available.length > 0) {
    let bestIndex = 0;
    let bestTuple: [number, number, number, number, number, string] | undefined;

    for (let index = 0; index < available.length; index += 1) {
      const entry = available[index]!;
      const city = entry.event.city ?? 'unknown';
      const region = bundeslandForCity(entry.event.city).bundesland ?? 'unknown';
      const genre = primaryGenre(entry.event);
      const tuple: [number, number, number, number, number, string] = [
        cityCounts.get(city) ?? 0,
        regionCounts.get(region) ?? 0,
        genreCounts.get(genre) ?? 0,
        -(entry.event.importReadinessScore ?? 0),
        -startRank(entry.event.startsAt),
        entry.event.identityKey,
      ];

      if (!bestTuple || compareTuple(tuple, bestTuple) < 0) {
        bestTuple = tuple;
        bestIndex = index;
      }
    }

    const [entry] = available.splice(bestIndex, 1);
    if (!entry) break;

    picked.push(entry);
    selectedKeys.add(entry.event.identityKey);
    increment(cityCounts, entry.event.city ?? 'unknown');
    increment(
      regionCounts,
      bundeslandForCity(entry.event.city).bundesland ?? 'unknown',
    );
    increment(genreCounts, primaryGenre(entry.event));
  }

  return picked;
}

function compareTuple(
  left: [number, number, number, number, number, string],
  right: [number, number, number, number, number, string],
): number {
  for (let index = 0; index < 5; index += 1) {
    if (left[index] !== right[index]) {
      return (left[index] as number) - (right[index] as number);
    }
  }
  return left[5].localeCompare(right[5]);
}

export function selectM94EScaleCohort(input: {
  poolEntries: M94EQualityPoolEntry[];
  locationOnlySlugs: Set<string>;
  excludedIdentityKeys: Set<string>;
  targetSize?: number;
  locationOnlyShare?: number;
}): M94ECohortSelection {
  const targetSize = input.targetSize ?? 100;
  const locationOnlyShare = input.locationOnlyShare ?? 0.25;

  if (!Number.isInteger(targetSize) || targetSize <= 0) {
    throw new Error(`m94e_invalid_target_size:${targetSize}`);
  }

  const eligibleSnapshot = input.poolEntries.filter(snapshotEligible);
  const eligible = eligibleSnapshot.filter(
    (entry) => !input.excludedIdentityKeys.has(entry.event.identityKey),
  );

  if (eligible.length < targetSize) {
    throw new Error(
      `m94e_insufficient_snapshot_pool:needed=${targetSize}:available=${eligible.length}`,
    );
  }

  const locationOnlyPool = eligible.filter((entry) =>
    input.locationOnlySlugs.has(entry.event.ticketIoEventId),
  );
  const locationOnlyTarget = Math.min(
    locationOnlyPool.length,
    targetSize,
    Math.max(0, Math.floor(targetSize * locationOnlyShare)),
  );

  const selectedKeys = new Set<string>();
  const cityCounts = new Map<string, number>();
  const regionCounts = new Map<string, number>();
  const genreCounts = new Map<string, number>();

  const selected: M94EQualityPoolEntry[] = [];
  selected.push(
    ...selectDiverse(
      locationOnlyPool,
      locationOnlyTarget,
      selectedKeys,
      cityCounts,
      regionCounts,
      genreCounts,
    ),
  );
  selected.push(
    ...selectDiverse(
      eligible,
      targetSize - selected.length,
      selectedKeys,
      cityCounts,
      regionCounts,
      genreCounts,
    ),
  );

  if (selected.length !== targetSize) {
    throw new Error(
      `m94e_cohort_selection_shortfall:selected=${selected.length}:target=${targetSize}`,
    );
  }

  return {
    targetSize,
    eligibleSnapshotPool: eligibleSnapshot.length,
    eligibleAfterExclusions: eligible.length,
    excludedPreviousCohort: eligibleSnapshot.length - eligible.length,
    locationOnlyAvailable: locationOnlyPool.length,
    locationOnlyTarget,
    entries: selected.map((entry) => toCohortEntry(entry, input.locationOnlySlugs)),
  };
}
