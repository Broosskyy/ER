import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 18 event lifecycle migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260749000000_sprint18_event_lifecycle_engine.sql'),
    'utf8',
  );

  it('creates lifecycle history and change tables', () => {
    expect(sql).toContain('create table if not exists public.event_lifecycle_history');
    expect(sql).toContain('create table if not exists public.event_lifecycle_changes');
    expect(sql).toContain("'event_cancelled'");
    expect(sql).toContain("'apply_immediately'");
  });

  it('creates event series foundation', () => {
    expect(sql).toContain('create table if not exists public.event_series');
    expect(sql).toContain('event_series_id');
  });

  it('enables RLS on lifecycle tables', () => {
    expect(sql).toContain('event_lifecycle_history enable row level security');
    expect(sql).toContain('event_lifecycle_changes enable row level security');
    expect(sql).toContain('event_series enable row level security');
  });
});
