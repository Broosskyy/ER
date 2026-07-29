import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260756000000_service_role_backend_grants.sql',
);

describe('Service role backend grants migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');

  it('requires service_role to exist before granting privileges', () => {
    expect(sql).toContain("rolname = 'service_role'");
    expect(sql).toContain('service_role does not exist');
  });

  it('grants schema usage and explicit table privileges to service_role', () => {
    expect(sql).toContain('grant usage on schema public to service_role');
    expect(sql).toContain('grant select, insert, update, delete on table public.%I to service_role');
    expect(sql).toContain("'platform_operations_state'");
    expect(sql).toContain("'import_job_queue'");
    expect(sql).toContain("'scheduler_runs'");
    expect(sql).toContain("'sources'");
    expect(sql).toContain("'events'");
    expect(sql).toContain("'source_reputation_events'");
  });

  it('does not modify anon or authenticated grants', () => {
    expect(sql).not.toMatch(/grant\s+[^;]+\s+to\s+anon\b/i);
    expect(sql).not.toMatch(/grant\s+[^;]+\s+to\s+authenticated\b/i);
    expect(sql).toContain('revoke all on function public.claim_import_job_queue_entries');
    expect(sql).toContain('from anon');
    expect(sql).toContain('from authenticated');
  });

  it('does not disable RLS or grant blanket ALL TABLES', () => {
    expect(sql).not.toContain('disable row level security');
    expect(sql).not.toContain('GRANT ALL ON ALL TABLES');
    expect(sql).not.toContain('grant all on all tables');
  });

  it('grants sequence usage to service_role and restricts claim RPC to service_role', () => {
    expect(sql).toContain('grant usage, select on sequence');
    expect(sql).toContain('revoke all on function public.claim_import_job_queue_entries');
    expect(sql).toContain("from anon");
    expect(sql).toContain("from authenticated");
    expect(sql).toContain('grant execute on function public.claim_import_job_queue_entries');
    expect(sql).toContain('to service_role');
  });
});
