import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260742000000_real_data_entity_resolution_foundation.sql',
);

describe('real data entity resolution migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates additive entity alias and decision tables', () => {
    expect(sql).toContain('create table if not exists public.entity_identity_aliases');
    expect(sql).toContain('create table if not exists public.entity_resolution_decisions');
    expect(sql).not.toContain('drop table');
  });

  it('extends events with lifecycle timestamps without rewriting ids', () => {
    expect(sql).toContain('add column if not exists timezone');
    expect(sql).toContain('add column if not exists cancelled_at');
    expect(sql).toContain('add column if not exists canonical_event_id');
    expect(sql).not.toContain('update public.events set id');
  });

  it('tracks source presence and scheduling contract fields', () => {
    expect(sql).toContain('consecutive_missing_count');
    expect(sql).toContain('schedule_policy');
    expect(sql).toContain('create table if not exists public.import_schedule_locks');
  });
});
