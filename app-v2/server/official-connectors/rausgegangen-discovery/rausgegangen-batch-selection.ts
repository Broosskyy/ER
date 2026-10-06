import { bundeslandForCity } from '../ticket-evidence/network-discovery/germany-geography';
import type { EnrichedTicketIoEvent } from '../ticket-evidence/network-discovery/detail-types';
import {
  evaluateImportCandidateQualityContract,
  type ImportQualityContractResult,
} from '../ticket-evidence/network-discovery/import-quality-contract-gate';

export interface ProposedBatchEntry {
  identityKey: string;
  title: string;
  startsAt?: string;
  city?: string;
  regionSlug: string;
  bundesland?: string;
  sourceUrl: string;
  relevance: string;
  genres: string[];
  lineupCount: number;
  ticketUrl?: string;
  mediaUrl?: string;
  matchClassification: string;
  qualification: string;
  qualityState: string;
  domainState: string;
  qualityContract: ImportQualityContractResult;
}

function isElectronicDomain(domainState: string): boolean {
  return domainState === 'ELECTRONIC_HIGH' || domainState === 'ELECTRONIC_MEDIUM';
}

export function selectProposedM94BBatch(
  events: EnrichedTicketIoEvent[],
  targetSize = 15,
): ProposedBatchEntry[] {
  const ready = events
    .map((event) => ({
      event,
      qualityContract: evaluateImportCandidateQualityContract(event),
    }))
    .filter(
      (entry) =>
        entry.qualityContract.passesQualityContract &&
        !entry.qualityContract.qualityContractBypass &&
        isElectronicDomain(entry.qualityContract.domainState) &&
        entry.qualityContract.identityState === 'NET_NEW' &&
        entry.event.lifecycle !== 'ENDED',
    )
    .sort((left, right) => (right.event.importReadinessScore ?? 0) - (left.event.importReadinessScore ?? 0));

  const selected: ProposedBatchEntry[] = [];
  const usedCities = new Set<string>();
  const usedBundeslaender = new Set<string>();
  const usedGenres = new Set<string>();

  for (const entry of ready) {
    if (selected.length >= targetSize) {
      break;
    }
    const city = entry.event.city ?? 'unknown';
    const bundesland = bundeslandForCity(entry.event.city).bundesland ?? 'unknown';
    const genre =
      entry.event.genreCandidates.find((candidate) => candidate.confidence !== 'weak_inferred')?.label ??
      entry.event.genreCandidates[0]?.label ??
      'unknown';
    const diversityPenalty =
      (usedCities.has(city) ? 1 : 0) + (usedBundeslaender.has(bundesland) ? 1 : 0) + (usedGenres.has(genre) ? 1 : 0);
    if (selected.length >= 5 && diversityPenalty >= 2) {
      continue;
    }
    selected.push({
      identityKey: entry.event.identityKey,
      title: entry.event.title,
      startsAt: entry.event.startsAt,
      city: entry.event.city,
      regionSlug: entry.event.shopSlug,
      bundesland,
      sourceUrl: entry.event.canonicalUrl,
      relevance: entry.event.relevance,
      genres: entry.event.genreCandidates.map((genreEntry) => genreEntry.label),
      lineupCount: entry.event.lineupHints.length,
      ticketUrl: entry.event.eventUrl,
      mediaUrl: entry.event.bestMediaUrl,
      matchClassification: entry.event.matchClassification,
      qualification: entry.event.qualification,
      qualityState: entry.qualityContract.qualityState,
      domainState: entry.qualityContract.domainState,
      qualityContract: entry.qualityContract,
    });
    usedCities.add(city);
    usedBundeslaender.add(bundesland);
    usedGenres.add(genre);
  }

  return selected;
}

export function selectProposedM94DBatch(
  events: EnrichedTicketIoEvent[],
  targetSize = 40,
  locationOnlySlugs?: Set<string>,
): ProposedBatchEntry[] {
  const ready = events
    .map((event) => ({
      event,
      qualityContract: evaluateImportCandidateQualityContract(event),
    }))
    .filter(
      (entry) =>
        entry.qualityContract.passesQualityContract &&
        !entry.qualityContract.qualityContractBypass &&
        isElectronicDomain(entry.qualityContract.domainState) &&
        entry.event.lifecycle !== 'ENDED',
    )
    .sort((left, right) => (right.event.importReadinessScore ?? 0) - (left.event.importReadinessScore ?? 0));

  const selected: ProposedBatchEntry[] = [];
  const usedCities = new Set<string>();
  const usedGenres = new Set<string>();
  let locationOnlySelected = 0;

  const toEntry = (entry: { event: EnrichedTicketIoEvent; qualityContract: ImportQualityContractResult }): ProposedBatchEntry => ({
    identityKey: entry.event.identityKey,
    title: entry.event.title,
    startsAt: entry.event.startsAt,
    city: entry.event.city,
    regionSlug: entry.event.shopSlug,
    bundesland: bundeslandForCity(entry.event.city).bundesland,
    sourceUrl: entry.event.canonicalUrl,
    relevance: entry.event.relevance,
    genres: entry.event.genreCandidates.map((genreEntry) => genreEntry.label),
    lineupCount: entry.event.lineupHints.length,
    ticketUrl: entry.event.eventUrl,
    mediaUrl: entry.event.bestMediaUrl,
    matchClassification: entry.event.matchClassification,
    qualification: entry.event.qualification,
    qualityState: entry.qualityContract.qualityState,
    domainState: entry.qualityContract.domainState,
    qualityContract: entry.qualityContract,
  });

  const locationOnlyPool = ready.filter((entry) => locationOnlySlugs?.has(entry.event.ticketIoEventId));
  for (const entry of locationOnlyPool) {
    if (selected.length >= targetSize || locationOnlySelected >= Math.max(5, Math.floor(targetSize / 4))) {
      break;
    }
    selected.push(toEntry(entry));
    locationOnlySelected += 1;
    usedCities.add(entry.event.city ?? 'unknown');
  }

  for (const entry of ready) {
    if (selected.length >= targetSize) {
      break;
    }
    if (selected.some((item) => item.identityKey === entry.event.identityKey)) {
      continue;
    }
    const city = entry.event.city ?? 'unknown';
    const genre =
      entry.event.genreCandidates.find((candidate) => candidate.confidence !== 'weak_inferred')?.label ??
      entry.event.genreCandidates[0]?.label ??
      'unknown';
    const diversityPenalty =
      (usedCities.has(city) ? 1 : 0) + (usedGenres.has(genre) ? 1 : 0);
    if (selected.length >= targetSize / 2 && diversityPenalty >= 2) {
      continue;
    }
    selected.push(toEntry(entry));
    usedCities.add(city);
    usedGenres.add(genre);
  }

  return selected;
}
