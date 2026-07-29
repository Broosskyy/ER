import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 17 multi-source matching migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260748000000_sprint17_multi_source_matching.sql'),
    'utf8',
  );

  it('creates blocking key index table', () => {
    expect(sql).toContain('create table if not exists public.event_blocking_keys');
    expect(sql).toContain('event_blocking_keys_lookup_idx');
  });

  it('creates match evaluation and merge candidate tables', () => {
    expect(sql).toContain('create table if not exists public.event_match_evaluations');
    expect(sql).toContain('create table if not exists public.event_merge_candidates');
    expect(sql).toContain("'auto_link'");
    expect(sql).toContain("'review_required'");
    expect(sql).toContain("'keep_separate'");
  });

  it('extends import_records with match_evaluation_id', () => {
    expect(sql).toContain('match_evaluation_id');
  });

  it('enables RLS on matching tables', () => {
    expect(sql).toContain('event_blocking_keys enable row level security');
    expect(sql).toContain('event_match_evaluations enable row level security');
    expect(sql).toContain('event_merge_candidates enable row level security');
  });
});
