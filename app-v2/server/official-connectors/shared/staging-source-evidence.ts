import type { LinkedQueryExecutor } from '../../ingestion/sync/linked-db';
import { parseLinkedQueryRows } from '../../ingestion/sync/linked-db';
import type { StagingEventSnapshot } from '../../ingestion/sync/canonical-consolidation';
import { parseDescriptionExplicitGenres } from './parse-description-genres';
import { separateStructuredEventContent } from './structured-content-separation';
import { normalizedGenresToExplicitLabels, normalizeOfficialGenreLabels } from './normalize-genre';
import { isLineupPlaceholderLine, normalizeLineupName } from './lineup-normalization';

export interface SourcePayloadRow {
  source_url: string;
  source_role: string;
  raw_payload: Record<string, unknown> | null;
}

export function loadEventSourcePayloads(
  runQuery: LinkedQueryExecutor,
  eventId: string,
): SourcePayloadRow[] {
  return parseLinkedQueryRows<SourcePayloadRow>(
    runQuery(
      `SELECT source_url, source_role, raw_payload FROM public.event_sources WHERE event_id = '${eventId}'::uuid`,
    ),
  );
}

function payloadString(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function payloadStringArray(payload: Record<string, unknown>, key: string): string[] {
  const value = payload[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

export function extractStructuredGenreLabels(payload: Record<string, unknown>): string[] {
  const labels = new Set<string>();
  for (const key of ['explicitGenreLabels', 'genreLabels', 'genres']) {
    for (const label of payloadStringArray(payload, key)) {
      labels.add(label);
    }
  }
  const normalized = payload.normalizedGenres;
  if (Array.isArray(normalized)) {
    for (const entry of normalized) {
      if (entry && typeof entry === 'object' && 'displayName' in entry) {
        const displayName = (entry as { displayName?: string }).displayName;
        if (displayName?.trim()) {
          labels.add(displayName.trim());
        }
      }
    }
  }
  return [...labels];
}

export function extractLineupFromPayload(payload: Record<string, unknown>): string[] {
  const lineupCandidates = payload.lineupCandidates;
  if (!Array.isArray(lineupCandidates)) {
    return [];
  }
  const names: string[] = [];
  for (const candidate of lineupCandidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }
    const displayName = (candidate as { displayName?: string }).displayName;
    if (displayName?.trim()) {
      names.push(normalizeLineupName(displayName));
    }
  }
  return names.filter((name) => name && !isLineupPlaceholderLine(name));
}

export function collectDescriptionTexts(
  event: StagingEventSnapshot,
  sourceRows: SourcePayloadRow[],
): string[] {
  const texts = new Set<string>();
  if (event.description?.trim()) {
    texts.add(event.description.trim());
  }
  for (const row of sourceRows) {
    const payload = row.raw_payload ?? {};
    for (const key of ['descriptionClean', 'descriptionRaw', 'description']) {
      const value = payloadString(payload, key);
      if (value) {
        texts.add(value);
      }
    }
  }
  return [...texts];
}

export function collectGenreEvidenceLabels(
  event: StagingEventSnapshot,
  sourceRows: SourcePayloadRow[],
): { labels: string[]; checkedLayers: string[] } {
  const labels = new Set<string>(event.genres);
  const checkedLayers: string[] = [];
  if (event.genres.length > 0) {
    checkedLayers.push('canonical_db');
  }

  for (const text of collectDescriptionTexts(event, sourceRows)) {
    const separated = separateStructuredEventContent(text);
    for (const label of [...parseDescriptionExplicitGenres(text), ...separated.genreCandidates]) {
      labels.add(label);
    }
  }
  if (labels.size > event.genres.length) {
    checkedLayers.push('description');
  }

  for (const row of sourceRows) {
    const payload = row.raw_payload ?? {};
    const structured = extractStructuredGenreLabels(payload);
    if (structured.length > 0) {
      checkedLayers.push(`structured_source:${row.source_role}`);
      for (const label of structured) {
        labels.add(label);
      }
    }
  }

  return { labels: [...labels], checkedLayers };
}

export function collectLineupEvidence(
  event: StagingEventSnapshot,
  sourceRows: SourcePayloadRow[],
): { lineup: string[]; checkedLayers: string[] } {
  const checkedLayers: string[] = [];
  const canonical = event.lineup
    .map((name) => normalizeLineupName(name))
    .filter((name) => name && !isLineupPlaceholderLine(name));
  if (canonical.length > 0) {
    checkedLayers.push('canonical_db');
  }

  const recovered = new Set<string>(canonical);
  for (const row of sourceRows) {
    const payload = row.raw_payload ?? {};
    const fromPayload = extractLineupFromPayload(payload);
    if (fromPayload.length > 0) {
      checkedLayers.push(`source_payload:${row.source_role}`);
      for (const name of fromPayload) {
        recovered.add(name);
      }
    }
  }

  return { lineup: [...recovered], checkedLayers };
}

export function normalizeGenreLabelSet(labels: string[]): string[] {
  return normalizedGenresToExplicitLabels(normalizeOfficialGenreLabels(labels).normalized);
}
