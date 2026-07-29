import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 16 trust quality migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260747000000_sprint16_trust_quality_engine.sql'),
    'utf8',
  );

  it('creates trust_quality_rules with seeded defaults', () => {
    expect(sql).toContain('create table if not exists public.trust_quality_rules');
    expect(sql).toContain("'required_title'");
    expect(sql).toContain("'duplicate_threshold'");
  });

  it('creates import_review_queue table', () => {
    expect(sql).toContain('create table if not exists public.import_review_queue');
    expect(sql).toContain("'pending'");
    expect(sql).toContain("'on_hold'");
  });

  it('creates source_reputation_events and extends sources trust columns', () => {
    expect(sql).toContain('create table if not exists public.source_reputation_events');
    expect(sql).toContain('computed_trust_score');
    expect(sql).toContain('trust_score_updated_at');
  });

  it('enables RLS on trust quality tables', () => {
    expect(sql).toContain('trust_quality_rules enable row level security');
    expect(sql).toContain('import_review_queue enable row level security');
    expect(sql).toContain('source_reputation_events enable row level security');
  });
});
