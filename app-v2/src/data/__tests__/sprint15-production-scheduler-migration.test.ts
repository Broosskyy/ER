import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 15 production scheduler migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260746000000_sprint15_production_scheduler.sql'),
    'utf8',
  );

  it('adds schedule interval preset and maintenance mode', () => {
    expect(sql).toContain('schedule_interval_preset');
    expect(sql).toContain('scheduler_maintenance_mode');
    expect(sql).toContain('every_15_minutes');
    expect(sql).toContain('daily');
  });

  it('creates scheduler_runs and import_job_queue tables', () => {
    expect(sql).toContain('create table if not exists public.scheduler_runs');
    expect(sql).toContain('create table if not exists public.import_job_queue');
  });

  it('enables RLS on scheduler tables', () => {
    expect(sql).toContain('scheduler_runs enable row level security');
    expect(sql).toContain('import_job_queue enable row level security');
    expect(sql).toContain('import_schedule_locks enable row level security');
  });
});
