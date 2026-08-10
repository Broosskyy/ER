import { createHash } from 'node:crypto';

export const APPROVED_MANIFEST_HASH =
  'c00344f2c8f43f22c5699aade8006bb6e82ed3507556120d8637f47f29a1e08f';

export const INVALID_PRIOR_MANIFEST_HASH =
  '978aed3839e10116d7b2cab20564c2e6c9ec045869cd73401780820bd175dad5';

export const APPLY_CONFIRMATION_TOKEN = 'exact:phase48674-first-restricted-bulk';

export const ALLOWED_PATCH_FIELDS = ['priceText', 'ticketStatus'] as const;

export type AllowedPatchField = (typeof ALLOWED_PATCH_FIELDS)[number];

export const APPROVED_CANDIDATE_FIELDS: Record<string, readonly AllowedPatchField[]> = {
  'evt-1785506397824-yhn81xp': ['priceText'],
  'evt-1785506404218-hgmd9nz': ['priceText'],
  'evt-1785506439487-2hr731q': ['ticketStatus'],
  'evt-1785506472665-1b5azyj': ['priceText'],
  'evt-1785672261305-bgdu8dk': ['ticketStatus'],
  'evt-1785443904478-dg3lk70': ['priceText', 'ticketStatus'],
  'evt-1785443908695-6n8vfff': ['priceText', 'ticketStatus'],
  'evt-1785506428527-m5ugmjh': ['priceText', 'ticketStatus'],
};

export const APPROVED_EVENT_IDS = Object.keys(APPROVED_CANDIDATE_FIELDS).sort();

export const APPROVED_FIELD_MUTATION_COUNT = 11;

export interface RestrictedBulkManifestEntry {
  eventId: string;
  identityVerdict?: string;
  verifiedAt?: string | null;
  beforeFingerprint: Record<string, unknown>;
  fieldGroupPatch: Record<string, { before: unknown; after: unknown }>;
  provenancePlan?: Array<{ fieldPath: string; sourceId?: string; freshnessAt?: string }>;
  consumerBefore?: Record<string, unknown>;
  consumerAfter?: Record<string, unknown>;
  rollback?: Record<string, unknown>;
}

export interface RestrictedBulkManifest {
  phase: string;
  invalidPriorManifestHash?: string;
  candidateCount: number;
  patchSemantics: string;
  entries: RestrictedBulkManifestEntry[];
  manifestHash?: string;
  productionMutationsInThisRun?: number;
  rolloutActivated?: boolean;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, entry) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return Object.keys(entry as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (entry as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return entry;
  });
}

export function computeRestrictedBulkManifestHash(plan: RestrictedBulkManifest): string {
  const body = {
    phase: plan.phase,
    invalidPriorManifestHash: plan.invalidPriorManifestHash,
    candidateCount: plan.candidateCount,
    patchSemantics: plan.patchSemantics,
    entries: plan.entries.map((entry) => {
      const extra = entry as unknown as Record<string, unknown>;
      return {
        eventId: entry.eventId,
        clusterId: extra.clusterId,
        rowOrigin: extra.rowOrigin,
        identityVerdict: entry.identityVerdict,
        verifiedAt: entry.verifiedAt,
        beforeFingerprint: entry.beforeFingerprint,
        allowedFieldGroups: extra.allowedFieldGroups,
        fieldGroupPatch: entry.fieldGroupPatch,
        blockedFields: extra.blockedFields,
        provenancePlan: entry.provenancePlan,
        consumerBefore: entry.consumerBefore,
        consumerAfter: entry.consumerAfter,
        rollback: entry.rollback,
        cleanRebuildAudit: extra.cleanRebuildAudit,
      };
    }),
  };
  return createHash('sha256').update(stableStringify(body)).digest('hex');
}

export function assertConfirmationToken(token: string | undefined): void {
  if (token !== APPLY_CONFIRMATION_TOKEN) {
    throw new Error(`CONFIRM_PRODUCTION_MUTATION must be ${APPLY_CONFIRMATION_TOKEN}`);
  }
}

export function validateManifestPlan(plan: RestrictedBulkManifest): {
  ok: boolean;
  computedHash: string;
  failures: string[];
} {
  const failures: string[] = [];
  const computedHash = computeRestrictedBulkManifestHash(plan);

  if (computedHash !== APPROVED_MANIFEST_HASH) {
    failures.push(`manifest_hash_mismatch:${computedHash}`);
  }
  if (plan.invalidPriorManifestHash !== INVALID_PRIOR_MANIFEST_HASH) {
    failures.push('invalid_prior_hash_not_marked');
  }
  if (plan.candidateCount !== 8) {
    failures.push(`candidate_count:${plan.candidateCount}`);
  }
  if (plan.entries.length !== 8) {
    failures.push(`entry_count:${plan.entries.length}`);
  }

  const entryIds = plan.entries.map((e) => e.eventId).sort();
  if (JSON.stringify(entryIds) !== JSON.stringify(APPROVED_EVENT_IDS)) {
    failures.push(`event_ids_mismatch:${entryIds.join(',')}`);
  }

  let mutationCount = 0;
  for (const entry of plan.entries) {
    const approved = APPROVED_CANDIDATE_FIELDS[entry.eventId];
    if (!approved) {
      failures.push(`unapproved_event:${entry.eventId}`);
      continue;
    }
    const patchFields = Object.keys(entry.fieldGroupPatch ?? {});
    if (patchFields.length !== approved.length) {
      failures.push(`field_count_mismatch:${entry.eventId}`);
    }
    for (const field of patchFields) {
      if (!ALLOWED_PATCH_FIELDS.includes(field as AllowedPatchField)) {
        failures.push(`forbidden_field:${entry.eventId}:${field}`);
      }
      if (!approved.includes(field as AllowedPatchField)) {
        failures.push(`unapproved_field:${entry.eventId}:${field}`);
      }
      mutationCount += 1;
    }
    for (const field of Object.keys(entry.beforeFingerprint ?? {})) {
      if (
        !['title', 'startDate', 'endDate', 'venueName', 'organizerName', 'websiteUrl', 'ticketUrl', 'priceText', 'ticketStatus', 'genreLabels', 'descriptionLength'].includes(
          field,
        )
      ) {
        failures.push(`whole_row_fingerprint_field:${entry.eventId}:${field}`);
      }
    }
  }

  if (mutationCount !== APPROVED_FIELD_MUTATION_COUNT) {
    failures.push(`mutation_count:${mutationCount}`);
  }

  return { ok: failures.length === 0, computedHash, failures };
}

export function filterManifestPatch(
  entry: RestrictedBulkManifestEntry,
): Record<AllowedPatchField, unknown> {
  const approved = APPROVED_CANDIDATE_FIELDS[entry.eventId] ?? [];
  const patch: Partial<Record<AllowedPatchField, unknown>> = {};
  for (const field of approved) {
    const delta = entry.fieldGroupPatch[field];
    if (!delta?.after) {
      throw new Error(`missing_manifest_after:${entry.eventId}:${field}`);
    }
    patch[field] = delta.after;
  }
  return patch as Record<AllowedPatchField, unknown>;
}

export const HARD_BLOCKED_WRITER_FIELDS = [
  'ticketPhases',
  'ticketUrl',
  'websiteUrl',
  'title',
  'description',
  'startDate',
  'endDate',
  'venueName',
  'organizerName',
  'genreLabels',
  'imageUrl',
] as const;

export function rejectWholeRowReplacement(
  writerFieldChanges: string[],
  allowedFields: readonly string[],
): string[] {
  return writerFieldChanges.filter(
    (field) =>
      HARD_BLOCKED_WRITER_FIELDS.includes(field as (typeof HARD_BLOCKED_WRITER_FIELDS)[number]) &&
      !allowedFields.includes(field),
  );
}

export function rejectStatusDowngrade(
  beforeStatus: string | undefined,
  afterStatus: string | undefined,
  field: string,
): boolean {
  if (field !== 'ticketStatus') return false;
  return beforeStatus === 'on_sale' && afterStatus === 'external_link';
}

export interface RestrictedBulkWriteCounters {
  attemptedApplicationEvents: number;
  successfulApplicationEvents: number;
  failedApplicationEvents: number;
  eventUpdateRequests: number;
  eventFieldMutations: number;
  importRecordWriteRequests: number;
  provenanceWriteRequests: number;
  provenanceAffectedRows: number;
  sourceReferenceWriteRequests: number;
  sourceReferenceAffectedRows: number;
  rollbackWriteRequests: number;
  rollbackAffectedRows: number;
  retryWriteRequests: number;
  databaseWriteRequests: number;
  affectedRows: number;
  totalProductionWriteOperations: number;
}

export function createRestrictedBulkWriteCounters(): RestrictedBulkWriteCounters {
  return {
    attemptedApplicationEvents: 0,
    successfulApplicationEvents: 0,
    failedApplicationEvents: 0,
    eventUpdateRequests: 0,
    eventFieldMutations: 0,
    importRecordWriteRequests: 0,
    provenanceWriteRequests: 0,
    provenanceAffectedRows: 0,
    sourceReferenceWriteRequests: 0,
    sourceReferenceAffectedRows: 0,
    rollbackWriteRequests: 0,
    rollbackAffectedRows: 0,
    retryWriteRequests: 0,
    databaseWriteRequests: 0,
    affectedRows: 0,
    totalProductionWriteOperations: 0,
  };
}

export function recordDbWrite(
  counters: RestrictedBulkWriteCounters,
  category: 'event' | 'provenance' | 'sourceReference' | 'importRecord' | 'rollback',
  affectedRows = 1,
  fieldMutations = 0,
  isRetry = false,
): void {
  counters.databaseWriteRequests += 1;
  counters.affectedRows += affectedRows;
  counters.totalProductionWriteOperations += 1;
  if (isRetry) counters.retryWriteRequests += 1;

  switch (category) {
    case 'event':
      counters.eventUpdateRequests += 1;
      counters.eventFieldMutations += fieldMutations;
      break;
    case 'provenance':
      counters.provenanceWriteRequests += 1;
      counters.provenanceAffectedRows += affectedRows;
      break;
    case 'sourceReference':
      counters.sourceReferenceWriteRequests += 1;
      counters.sourceReferenceAffectedRows += affectedRows;
      break;
    case 'importRecord':
      counters.importRecordWriteRequests += 1;
      break;
    case 'rollback':
      counters.rollbackWriteRequests += 1;
      counters.rollbackAffectedRows += affectedRows;
      break;
    default:
      break;
  }
}

export function productionMutationsInThisRun(counters: RestrictedBulkWriteCounters): number {
  return counters.totalProductionWriteOperations;
}
