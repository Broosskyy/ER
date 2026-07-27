import { describe, expect, it } from 'vitest';

import {
  mapImportRecordStatusToPipelineStatus,
  mapPipelineStatusToImportRecordStatus,
} from '@/features/aggregation/mappers/status-mapper';

describe('pipeline status mapper', () => {
  it('maps aggregation statuses to legacy import record statuses', () => {
    expect(mapPipelineStatusToImportRecordStatus('pending_review')).toBe('needs_review');
    expect(mapPipelineStatusToImportRecordStatus('published')).toBe('imported');
    expect(mapPipelineStatusToImportRecordStatus('duplicate')).toBe('duplicate');
  });

  it('maps import record statuses back to aggregation statuses', () => {
    expect(mapImportRecordStatusToPipelineStatus('needs_review')).toBe('pending_review');
    expect(mapImportRecordStatusToPipelineStatus('imported')).toBe('published');
  });
});
