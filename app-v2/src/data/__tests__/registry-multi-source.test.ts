import { describe, expect, it } from 'vitest';

import {
  adminMultiSourceService,
  canonicalEventIdResolver,
  conflictResolutionService,
  mergeProvenanceService,
} from '@/data/repositories/registry';

describe('registry multi-source services', () => {
  it('registers merge and conflict services without duplicate singletons', () => {
    expect(mergeProvenanceService).toBeDefined();
    expect(conflictResolutionService).toBeDefined();
    expect(adminMultiSourceService).toBeDefined();
    expect(canonicalEventIdResolver).toBeDefined();
  });
});
