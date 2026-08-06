import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase 4.6 entity follows migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260801120000_phase46_entity_follows.sql'),
    'utf8',
  );

  it('creates a unique authenticated follow relation', () => {
    expect(sql).toContain('create table if not exists public.entity_follows');
    expect(sql).toContain("check (entity_type in ('organizer', 'venue', 'artist'))");
    expect(sql).toContain('entity_follows_user_entity_uidx');
    expect(sql).toContain('auth.uid() = user_id');
  });

  it('enables public count reads with own-write RLS', () => {
    expect(sql).toContain('entity_follows_select_public_counts');
    expect(sql).toContain('entity_follows_insert_own');
    expect(sql).toContain('entity_follows_delete_own');
  });
});
