import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 14 event domain foundation migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260745000000_sprint14_event_domain_foundation.sql'),
    'utf8',
  );

  it('creates festival and festival_edition tables', () => {
    expect(sql).toContain('create table if not exists public.festivals');
    expect(sql).toContain('create table if not exists public.festival_editions');
    expect(sql).toContain('festival_edition_id');
  });

  it('extends venue model with venue_type and is_temporary', () => {
    expect(sql).toContain('venue_type');
    expect(sql).toContain('is_temporary');
    expect(sql).toContain('festival_ground');
  });

  it('adds event entity type to identity aliases', () => {
    expect(sql).toContain("'event'");
    expect(sql).toContain('entity_identity_aliases_entity_type_check');
  });

  it('enables admin RLS on provenance tables', () => {
    expect(sql).toContain('event_source_references enable row level security');
    expect(sql).toContain('event_field_provenance enable row level security');
    expect(sql).toContain('event_conflicts enable row level security');
    expect(sql).toContain('duplicate_decisions enable row level security');
  });
});
