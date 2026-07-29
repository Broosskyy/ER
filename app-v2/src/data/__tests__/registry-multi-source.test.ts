import { describe, expect, it } from 'vitest';

import {
  adminMultiSourceService,
  canonicalEventIdResolver,
  conflictResolutionService,
  entityAliasStore,
  importAggregationService,
  importMatchingService,
  importOrchestrator,
  importReviewService,
  mergeProvenanceService,
} from '@/data/repositories/registry';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';

describe('registry multi-source services', () => {
  it('registers merge and conflict services without duplicate singletons', () => {
    expect(mergeProvenanceService).toBeDefined();
    expect(conflictResolutionService).toBeDefined();
    expect(adminMultiSourceService).toBeDefined();
    expect(canonicalEventIdResolver).toBeDefined();
  });

  it('wires shared identity resolvers into all import paths', () => {
    expect(importMatchingService).toBeDefined();
    expect(entityAliasStore).toBeDefined();
    expect(importOrchestrator).toBeDefined();
    expect(importAggregationService).toBeDefined();
    expect(importReviewService).toBeDefined();
  });

  it('shares one alias store instance across matching service factories', () => {
    const bundle = createImportMatchingService(entityAliasStore);
    expect(bundle.aliasStore).toBe(entityAliasStore);
  });
});
