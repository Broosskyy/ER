import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Sprint 26.6 go-live migration', () => {
  it('adds atomic queue claim and enables Bootshaus schedule', () => {
    const sql = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260754000000_sprint26_6_go_live_readiness.sql'),
      'utf8',
    );

    expect(sql).toContain('claim_import_job_queue_entries');
    expect(sql).toContain("for update skip locked");
    expect(sql).toContain('worker_id');
    expect(sql).toContain('processing_started_at');
    expect(sql).toContain("schedule_policy = 'interval'");
    expect(sql).toContain("schedule_interval_preset = 'every_6_hours'");
    expect(sql).toContain("where id = 'source-bootshaus-koeln'");
  });
});
