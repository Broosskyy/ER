import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import type { StagingEventSnapshot } from '../../../ingestion/sync/canonical-consolidation';
import { buildGenreCandidates } from '../../ticket-evidence/network-discovery/field-evidence';
import { classifyRelevanceEvidence } from '../../ticket-evidence/network-discovery/relevance-evidence';
import { extractEditorialDescription } from '../description-quality';
import {
  collectDescriptionTexts,
  extractLineupFromPayload,
  loadEventSourcePayloads,
} from '../staging-source-evidence';
import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import {
  classifyDomainFromRelevance,
  classifyImportQualification,
} from './domain-classification';
import type { DiscoverySignalBundle } from './types';

const STRONG_HIT_TO_GENRE: Record<string, string> = {
  techno: 'Techno',
  hard_techno: 'Hard Techno',
  hard_techno_abbrev: 'Hard Techno',
  house: 'House',
  deep_house: 'Deep House',
  tech_house: 'Tech House',
  melodic_techno: 'Melodic Techno',
  trance: 'Trance',
  psytrance: 'Psytrance',
  hardstyle: 'Hardstyle',
  hardcore: 'Hardcore',
  gabber: 'Gabber',
  dnb: "Drum'n'Bass",
  dnb_short: "Drum'n'Bass",
  jungle: 'Jungle',
  electro: 'Electro',
  edm: 'EDM',
  minimal: 'Minimal Techno',
  industrial: 'Industrial Techno',
  schranz: 'Techno',
};

function discoveryGenreLabelsFromRelevance(
  strongHits: string[],
  genreCandidates: Array<{ label: string; confidence: string }>,
): string[] {
  const labels = new Set<string>();
  for (const hit of strongHits) {
    const mapped = STRONG_HIT_TO_GENRE[hit];
    if (mapped) {
      labels.add(mapped);
    }
  }
  for (const candidate of genreCandidates) {
    if (candidate.confidence === 'explicit' || candidate.confidence === 'strong_inferred') {
      labels.add(candidate.label);
    }
  }
  return [...labels];
}

function loadArtifactRelevanceByUrl(artifactRoot: string): Map<string, Record<string, unknown>> {
  const path = join(artifactRoot, 'relevance.json');
  if (!existsSync(path)) {
    return new Map();
  }
  try {
    const payload = JSON.parse(readFileSync(path, 'utf8')) as Array<Record<string, unknown>>;
    const map = new Map<string, Record<string, unknown>>();
    for (const entry of payload) {
      const url = String(entry.eventUrl ?? entry.url ?? '');
      if (url) {
        map.set(url, entry);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export function buildDiscoverySignalBundle(input: {
  event: StagingEventSnapshot;
  sourceRows: ReturnType<typeof loadEventSourcePayloads>;
  artifactRelevance?: Map<string, Record<string, unknown>>;
}): DiscoverySignalBundle {
  const descriptions = collectDescriptionTexts(input.event, input.sourceRows);
  const editorial = descriptions.map((text) => extractEditorialDescription(text)).find(Boolean);
  const description = editorial ?? descriptions.find((text) => text.length > 0);

  const lineupHints = input.sourceRows.flatMap((row) =>
    extractLineupFromPayload(row.raw_payload ?? {}),
  );
  const genreHints = input.sourceRows.flatMap((row) => {
    const payload = row.raw_payload ?? {};
    const labels = [
      ...(Array.isArray(payload.explicitGenreLabels) ? payload.explicitGenreLabels : []),
      ...(Array.isArray(payload.genreLabels) ? payload.genreLabels : []),
    ];
    return labels.filter((entry): entry is string => typeof entry === 'string');
  });

  const relevance = classifyRelevanceEvidence({
    title: input.event.title,
    description,
    lineupHints,
    genreHints,
    venueName: input.event.venueName ?? undefined,
    organizerName: input.event.organizerName ?? undefined,
    detailAccess: 'AVAILABLE',
  });

  const ticketUrl = input.event.sources.find((source) => source.sourceRole === 'ticket')?.sourceUrl;
  const artifactEntry =
    (ticketUrl ? input.artifactRelevance?.get(ticketUrl) : undefined) ??
    input.event.sources
      .map((source) => input.artifactRelevance?.get(source.sourceUrl))
      .find(Boolean);

  if (artifactEntry?.strongPositiveHits && Array.isArray(artifactEntry.strongPositiveHits)) {
    for (const hit of artifactEntry.strongPositiveHits) {
      if (typeof hit === 'string' && !relevance.strongPositiveHits.includes(hit)) {
        relevance.strongPositiveHits.push(hit);
      }
    }
  }

  const genreCandidates = buildGenreCandidates([], input.event.title, description);
  const domainClassification = classifyDomainFromRelevance(relevance);
  const discoveryGenreLabels = discoveryGenreLabelsFromRelevance(
    relevance.strongPositiveHits,
    genreCandidates,
  );

  const importQualification = classifyImportQualification({
    relevance,
    hasTicketBinding: input.event.sources.some((source) => source.sourceRole === 'ticket'),
    hasOfficialBinding: input.event.sources.some((source) => source.sourceRole === 'official'),
    genreCandidateCount: genreCandidates.filter(
      (candidate) => candidate.confidence === 'explicit' || candidate.confidence === 'strong_inferred',
    ).length,
  });

  return {
    eventId: input.event.eventId,
    relevance,
    genreCandidates,
    importQualification,
    domainClassification,
    discoveryGenreLabels,
    strongDiscoverySignals: relevance.strongPositiveHits,
    weakDiscoverySignals: relevance.weakPositiveHits,
    sourceUrls: input.event.sources.map((source) => source.sourceUrl),
    connectorIds: input.event.sources.map((source) => source.connectorId ?? source.sourceRole),
  };
}

export function buildDiscoverySignalsForStaging(
  runQuery: LinkedQueryExecutor,
  events: StagingEventSnapshot[],
  artifactRoot?: string,
): Map<string, DiscoverySignalBundle> {
  const artifactRelevance = artifactRoot ? loadArtifactRelevanceByUrl(artifactRoot) : new Map();
  const map = new Map<string, DiscoverySignalBundle>();
  for (const event of events) {
    const sourceRows = loadEventSourcePayloads(runQuery, event.eventId);
    map.set(
      event.eventId,
      buildDiscoverySignalBundle({ event, sourceRows, artifactRelevance }),
    );
  }
  return map;
}
