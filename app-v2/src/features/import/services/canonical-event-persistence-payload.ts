import type { CanonicalLineupEntry } from '@/features/aggregation/domain/canonical-lineup-entry';
import type { BuildCanonicalEventFromVerifiedPublicEvidenceResult } from '@/features/import/domain/build-canonical-event-from-verified-public-evidence';
import { mapLineupEvidenceToCanonical } from '@/features/import/publish/unified-website-controlled-publish/apply';
import type { ImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';

/**
 * Single canonical persistence shape shared by import publish and golden projection.
 *
 * Maps 1:1 to production storage:
 * - `events.description`
 * - `events.genre_labels`
 * - `event_lineup_entries` (+ `event_lineup_entry_artists`)
 */
export interface CanonicalEventPersistencePayload {
  eventPatch: Pick<ImportPublishFieldPatch, 'description' | 'genreLabels'>;
  structuredLineupEntries: CanonicalLineupEntry[];
}

export function buildCanonicalEventPersistencePayload(
  buildResult: BuildCanonicalEventFromVerifiedPublicEvidenceResult,
): CanonicalEventPersistencePayload {
  const structuredLineupEntries =
    buildResult.lineupPatch.allowed && buildResult.lineupPatch.entries.length > 0
      ? mapLineupEvidenceToCanonical(buildResult.lineupPatch.entries)
      : [];

  return {
    eventPatch: {
      description: buildResult.canonicalPatch.description,
      genreLabels: buildResult.canonicalPatch.genreLabels,
    },
    structuredLineupEntries,
  };
}

export function billingNamesFromPersistencePayload(
  payload: CanonicalEventPersistencePayload,
): string[] {
  return [...payload.structuredLineupEntries]
    .sort((left, right) => left.order - right.order)
    .flatMap((entry) => entry.artists.map((name) => name.trim()).filter(Boolean));
}

export function toEventRowPersistenceShape(
  payload: CanonicalEventPersistencePayload,
): {
  description: string | null;
  genre_labels: string[] | null;
} {
  return {
    description: payload.eventPatch.description ?? null,
    genre_labels: payload.eventPatch.genreLabels?.length
      ? payload.eventPatch.genreLabels
      : null,
  };
}
