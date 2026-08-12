/**
 * Active import path registry — documents the single productive ingress and retired paths.
 */
export const ACTIVE_IMPORT_ENTRY = {
  module: '@/features/import/clean-import-core/source-pack/source-pack-import-entry',
  function: 'runSourcePackImport',
  flow: [
    'Source Connector',
    'SourceEvent validation',
    'Identity/Duplicate Resolution',
    'optional enrichment sources',
    'ImportDraft',
    'ReviewDecision',
    'Consumer Preview',
    'Noop Persistence',
  ],
  publishEntry: '@/features/import/services/import-event-publish-service (post-review only)',
} as const;

export const RETIRED_IMPORT_PATHS = [
  'scripts/operations/run-phase48682-live-staging.ts',
  'scripts/operations/run-phase48692-live-draft-staging.ts',
  'scripts/operations/run-phase48693-publish-preview.ts',
  'scripts/operations/run-phase48694-single-approved-draft-publish.ts',
  'features/import/services/import-orchestrator.ts (deprecated test shim)',
  'features/import/generic-truth-pipeline (publish-time merge only, not import ingress)',
] as const;

export const RETAINED_IMPORT_MODULES = [
  'clean-import-core/clean-multi-source-import-service.ts',
  'clean-import-core/unified-import-draft-service.ts',
  'clean-import-core/source-adapter.ts',
  'clean-import-core/identity-resolver.ts',
  'clean-import-core/cross-source-event-resolver.ts',
  'clean-import-core/duplicate-url-reconciliation.ts',
  'clean-import-core/draft-publish-eligibility.ts',
  'clean-import-core/admin-draft-review.ts',
  'aggregation/connectors/* (productive fetchers)',
  'services/import-event-publish-service.ts (controlled publish after review)',
] as const;

export const LEGACY_DATA_TRANSITION = {
  legacyDrafts: 'Mark 72 unified drafts as legacy in a later migration; no writes in this run.',
  publishedEvents:
    'Keep 93 published events visible; replace Bootshaus rows only after source-pack approval.',
  eventIds: 'Preserve existing event IDs when identity is exact.',
  favoritesAndDeepLinks: 'Unchanged until explicit replace publish.',
  duplicates: 'Archive old duplicates only after successful readback of replacements.',
  manualCommunityOrganizer: 'Never bulk-delete manual/community/organizer events.',
} as const;
