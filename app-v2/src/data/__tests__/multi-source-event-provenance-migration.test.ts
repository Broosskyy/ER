import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260741000000_multi_source_event_provenance.sql',
);

describe('multi source event provenance migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates provenance tables without rewriting canonical consumer events', () => {
    expect(sql).toContain('create table if not exists public.event_source_references');
    expect(sql).toContain('create table if not exists public.event_field_provenance');
    expect(sql).toContain('create table if not exists public.duplicate_decisions');
    expect(sql).toContain('create table if not exists public.event_conflicts');
    expect(sql).toContain('references public.events(id)');
    expect(sql).not.toContain('delete from public.events');
    expect(sql).not.toContain('update public.events set id');
  });

  it('keeps source and import references stable and idempotent', () => {
    expect(sql).toContain('unique (source_id, external_event_id)');
    expect(sql).toContain('unique (canonical_event_id, field_path)');
    expect(sql).toContain('create table if not exists');
    expect(sql).toContain('create index if not exists');
  });

  it('documents defensive additive rollout for country_code and saved ids', () => {
    expect(sql).toContain('Additive only');
    expect(sql).toContain('saved references are not rewritten');
  });
});
