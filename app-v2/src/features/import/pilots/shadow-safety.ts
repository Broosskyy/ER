export type ShadowImporterKey = 'official-website' | 'ticket-io' | 'ticket-kings' | 'nacht-manager';

export interface ShadowSafetyPlan {
  importer: ShadowImporterKey;
  importerVersion: string;
  sourceIds: string[];
  expectedEventCount: number;
  supportedFields: string[];
  intentionallyUnsupportedFields: string[];
  requestRateLimitPerMinute: number;
  evidenceStoragePath: string;
  noWriteEnforcement: string[];
  monitoring: string[];
  errorThresholdPercent: number;
  falseMergeThreshold: number;
  manualReviewOutputPath: string;
  durationHours: number;
  stopConditions: string[];
  rollbackProcedure: string[];
}

export const SHADOW_ABORT_CONDITIONS = [
  'any_production_write_attempt',
  'contract_schema_failure',
  'unexplained_identity_collision',
  'cross_event_contamination',
  'unexpected_event_count_growth',
  'importer_nondeterminism',
  'rate_limit_block_escalation',
] as const;

export function createOfficialWebsiteShadowPlan(input: {
  importerVersion: string;
  sourceIds: string[];
  eventCount: number;
}): ShadowSafetyPlan {
  return {
    importer: 'official-website',
    importerVersion: input.importerVersion,
    sourceIds: input.sourceIds,
    expectedEventCount: input.eventCount,
    supportedFields: ['title', 'description', 'flyer', 'gallery', 'date_time', 'venue', 'location', 'city', 'coordinates'],
    intentionallyUnsupportedFields: ['price', 'ticket_phases', 'availability', 'sold_out', 'checkout_url', 'lineup'],
    requestRateLimitPerMinute: 30,
    evidenceStoragePath: 'docs/real-data/_shadow_evidence/',
    noWriteEnforcement: [
      'stagingOnly: true on all pilot results',
      'no opsClient().from(events).insert/update',
      'no import_records mutations',
      'no review queue writes',
      'no scheduler changes',
    ],
    monitoring: [
      'contract schema validation per run',
      'contamination detector per batch',
      'identity cluster cardinality',
      'HTTP 429/403 rate',
    ],
    errorThresholdPercent: 5,
    falseMergeThreshold: 0,
    manualReviewOutputPath: 'docs/real-data/_shadow_review_queue.json',
    durationHours: 72,
    stopConditions: [...SHADOW_ABORT_CONDITIONS],
    rollbackProcedure: [
      'Abort shadow job immediately',
      'Discard shadow evidence artifacts only',
      'No canonical rollback required (read-only)',
      'File incident report with diagnostics',
    ],
  };
}

export function validateShadowNoWrite(context: { productionMutationsInThisRun: number; attemptedWrites?: string[] }): {
  ok: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  if (context.productionMutationsInThisRun > 0) {
    violations.push(`productionMutationsInThisRun=${context.productionMutationsInThisRun}`);
  }
  for (const attempt of context.attemptedWrites ?? []) {
    violations.push(attempt);
  }
  return { ok: violations.length === 0, violations };
}
