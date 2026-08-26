import type { EventCandidate } from '../types/event-candidate';
import type { ExistingOfficialSourceRecord } from '../types/event-candidate';
import {
  candidateInputFromEventCandidate,
  catalogEntryFromCandidate,
  matchEventToCatalog,
} from './event-matcher';
import type { EventMatchCatalogEntry, EventMatchResult, EventSourceBindingRecord } from './event-match-types';

export interface ResolveEventIdentityInput {
  candidate: EventCandidate;
  catalog: EventMatchCatalogEntry[];
  existingSources: ExistingOfficialSourceRecord[];
}

export function bindingRecordsFromExistingSources(
  existingSources: ExistingOfficialSourceRecord[],
): EventSourceBindingRecord[] {
  return existingSources.map((source) => ({
    sourceId: source.sourceId,
    eventId: source.eventId,
    sourceRole: source.sourceRole ?? 'official',
    sourceUrl: source.sourceUrl,
    sourceEventKey: source.sourceEventKey,
    connectorId: source.connectorId,
    contentHash: source.contentHash,
  }));
}

export function buildCatalogFromContext(
  catalog: EventMatchCatalogEntry[],
  existingSources: ExistingOfficialSourceRecord[],
): EventMatchCatalogEntry[] {
  const bindingsByEvent = new Map<string, EventSourceBindingRecord[]>();
  for (const binding of bindingRecordsFromExistingSources(existingSources)) {
    const current = bindingsByEvent.get(binding.eventId) ?? [];
    current.push(binding);
    bindingsByEvent.set(binding.eventId, current);
  }

  return catalog.map((entry) => ({
    ...entry,
    sourceBindings: [
      ...entry.sourceBindings,
      ...(bindingsByEvent.get(entry.eventId) ?? []).filter(
        (binding) =>
          !entry.sourceBindings.some(
            (existingBinding) =>
              existingBinding.sourceId === binding.sourceId ||
              existingBinding.sourceUrl === binding.sourceUrl,
          ),
      ),
    ],
  }));
}

export function resolveEventIdentity(input: ResolveEventIdentityInput): EventMatchResult {
  const mergedCatalog = buildCatalogFromContext(input.catalog, input.existingSources);
  return matchEventToCatalog(candidateInputFromEventCandidate(input.candidate), mergedCatalog);
}

export function registerPlannedCatalogEntry(
  catalog: EventMatchCatalogEntry[],
  candidate: EventCandidate,
  eventId: string,
  sourceBindings: EventSourceBindingRecord[] = [],
): EventMatchCatalogEntry[] {
  return [...catalog, catalogEntryFromCandidate(candidate, eventId, sourceBindings)];
}
