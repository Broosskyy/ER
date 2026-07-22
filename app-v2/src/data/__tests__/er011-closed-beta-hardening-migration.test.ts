import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260737000000_er011_closed_beta_production_hardening.sql',
);

describe('ER-011 closed beta production hardening migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('scopes reference-table writes to editor roles and above', () => {
    expect(sql).toContain('drop policy if exists "admin_manage_genres"');
    expect(sql).toContain('drop policy if exists "admin_manage_cities"');
    expect(sql).toContain('drop policy if exists "admin_manage_collections"');
    expect(sql).toContain("has_admin_role(array['editor', 'admin', 'owner'])");
  });

  it('scopes import and source policies to role-specific admin permissions', () => {
    expect(sql).toContain('drop policy if exists "admin_manage_sources"');
    expect(sql).toContain('drop policy if exists "admin_manage_import_jobs"');
    expect(sql).toContain('drop policy if exists "admin_manage_import_records"');
    expect(sql).toContain("has_admin_role(array['source_manager', 'admin', 'owner'])");
    expect(sql).toContain("has_admin_role(array['editor', 'reviewer', 'admin', 'owner'])");
  });

  it('restricts event image uploads to CMS editors', () => {
    expect(sql).toContain('drop policy if exists "admin_upload_event_images"');
    expect(sql).toContain("bucket_id = 'events'");
  });
});
