import type { CreateImportRecordInput, ImportRecord } from '@/features/import/models/types';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { recordCandidateEquivalent } from '@/features/import/services/import-record-identity';
import { detectSemanticChangeSet } from '@/features/import/services/published-reimport-reconciliation';

function createImportRecordId(): string {
  return `import-record-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function buildImportRecordFromInput(
  input: CreateImportRecordInput,
  options: { id?: string; now?: string; preserveResultingEventId?: string | null } = {},
): ImportRecord {
  const now = options.now ?? new Date().toISOString();
  return {
    id: options.id ?? createImportRecordId(),
    importJobId: input.importJobId,
    sourceId: input.sourceId,
    externalId: input.externalId,
    sourceUrl: input.sourceUrl,
    rawPayload: input.rawPayload,
    normalizedPayload: input.normalizedPayload,
    validationErrors: input.validationErrors,
    validationWarnings: input.validationWarnings,
    matchedCityId: input.matchedCityId,
    matchedVenueId: input.matchedVenueId,
    matchedOrganizerId: input.matchedOrganizerId,
    matchedArtistIds: input.matchedArtistIds,
    matchedGenreIds: input.matchedGenreIds,
    duplicateEventId: input.duplicateEventId,
    duplicateScore: input.duplicateScore,
    matchingWarnings: input.matchingWarnings,
    status: input.status ?? 'fetched',
    resultingEventId: options.preserveResultingEventId ?? undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export async function upsertImportRecordsBySourceExternal(
  inputs: CreateImportRecordInput[],
  deps: {
    findLatest: (sourceId: string, externalId: string) => Promise<ImportRecord | null>;
    create: (input: CreateImportRecordInput) => Promise<ImportRecord>;
    update: (record: ImportRecord) => Promise<ImportRecord>;
  },
): Promise<ImportRecord[]> {
  const results: ImportRecord[] = [];
  const now = new Date().toISOString();

  for (const input of inputs) {
    const existing = await deps.findLatest(input.sourceId, input.externalId);
    if (!existing) {
      results.push(await deps.create(input));
      continue;
    }

    const merged: ImportRecord = {
      ...existing,
      ...buildImportRecordFromInput(input, {
        id: existing.id,
        now,
        preserveResultingEventId: existing.resultingEventId ?? null,
      }),
      createdAt: existing.createdAt,
    };

    if (
      existing.resultingEventId &&
      input.normalizedPayload &&
      (recordCandidateEquivalent(existing, input.normalizedPayload as unknown as CanonicalImportEvent) ||
        detectSemanticChangeSet(
          {
            ...existing,
            normalizedPayload: input.normalizedPayload,
          },
          null,
        ).changeType === 'unchanged')
    ) {
      if (existing.status === 'imported' || existing.status === 'approved' || existing.status === 'duplicate') {
        merged.status = existing.status;
      }
      merged.resultingEventId = existing.resultingEventId;
    }

    results.push(await deps.update(merged));
  }

  return results;
}

export function listLatestImportRecordsBySource(records: ImportRecord[]): ImportRecord[] {
  const latest = new Map<string, ImportRecord>();
  const sorted = [...records].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  for (const record of sorted) {
    if (!latest.has(record.externalId)) {
      latest.set(record.externalId, record);
    }
  }
  return [...latest.values()];
}
