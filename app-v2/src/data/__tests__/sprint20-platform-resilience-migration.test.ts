import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 20 platform resilience migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260751000000_sprint20_platform_resilience.sql'),
    'utf8',
  );

  it('creates connector health and worker recovery tables', () => {
    expect(sql).toContain('connector_health_snapshots');
    expect(sql).toContain('worker_recovery_runs');
  });

  it('adds processing lease column to import_job_queue', () => {
    expect(sql).toContain('processing_lease_expires_at');
  });

  it('adds service role policies for ops tables', () => {
    expect(sql).toContain("auth.role() = 'service_role'");
    expect(sql).toContain('service_role_import_job_queue');
    expect(sql).toContain('service_role_worker_recovery_runs');
  });
});
