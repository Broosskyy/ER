import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 19 production operations migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260750000000_sprint19_production_operations.sql'),
    'utf8',
  );

  it('creates platform operations and backfill tables', () => {
    expect(sql).toContain('platform_operations_state');
    expect(sql).toContain('operations_backfill_jobs');
    expect(sql).toContain('source_intelligence_snapshots');
    expect(sql).toContain('worker_runs');
  });

  it('adds queue retry and dead letter columns', () => {
    expect(sql).toContain('attempt_count');
    expect(sql).toContain('max_attempts');
    expect(sql).toContain('next_retry_at');
    expect(sql).toContain('dead_lettered_at');
  });

  it('enables RLS on new tables', () => {
    expect(sql).toContain('platform_operations_state enable row level security');
    expect(sql).toContain('operations_backfill_jobs enable row level security');
    expect(sql).toContain('source_intelligence_snapshots enable row level security');
    expect(sql).toContain('worker_runs enable row level security');
  });
});
