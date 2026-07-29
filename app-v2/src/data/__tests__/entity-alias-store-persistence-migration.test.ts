import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260743000000_entity_alias_store_persistence.sql',
);

describe('entity alias store persistence migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('extends existing tables additively', () => {
    expect(sql).toContain('alter table public.entity_identity_aliases');
    expect(sql).toContain('alter table public.entity_resolution_decisions');
    expect(sql).not.toContain('drop table');
    expect(sql).not.toContain('delete from');
  });

  it('adds indexes and decision type constraints', () => {
    expect(sql).toContain('entity_identity_aliases_lookup_idx');
    expect(sql).toContain('entity_resolution_decisions_decision_idx');
    expect(sql).toContain('manual_match');
    expect(sql).toContain('keep_separate');
  });

  it('locks tables to admin-only RLS', () => {
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('admin_read_entity_identity_aliases');
    expect(sql).toContain('admin_write_entity_identity_aliases');
    expect(sql).toContain('public.is_admin()');
    expect(sql).not.toContain('for all using (true)');
  });
});
