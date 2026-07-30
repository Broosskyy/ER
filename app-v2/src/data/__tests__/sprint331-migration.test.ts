import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 33.1 migration extensions', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260766000000_sprint331_source_onboarding_rls.sql'),
    'utf8',
  );

  it('adds admin RLS policies for source_onboarding_jobs', () => {
    expect(sql).toContain('admin_read_source_onboarding_jobs');
    expect(sql).toContain('admin_write_source_onboarding_jobs');
  });

  it('extends operations_backfill_jobs with event_origins type', () => {
    expect(sql).toContain("'event_origins'");
    expect(sql).toContain('operations_backfill_jobs_backfill_type_check');
  });

  it('adds hostname uniqueness for active onboarding jobs', () => {
    expect(sql).toContain('source_onboarding_jobs_hostname_active_idx');
  });
});
