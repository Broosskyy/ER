import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260732000000_er006_platform_hardening.sql',
);

describe('ER-006 platform hardening migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('replaces broad admin_manage_events with scoped write policies', () => {
    expect(sql).toContain('drop policy if exists "admin_manage_events"');
    expect(sql).toContain('create policy "admin_insert_events"');
    expect(sql).toContain('create policy "admin_update_events"');
    expect(sql).toContain('create policy "admin_delete_events"');
  });

  it('restricts publish and reject to admin/owner at the database layer', () => {
    expect(sql).toContain("has_admin_role(array['admin', 'owner'])");
    expect(sql).toContain("new.status in ('published', 'rejected')");
  });

  it('protects contributor review events from non-moderation admin updates', () => {
    expect(sql).toContain('old.created_by is not null and old.status = \'review\'');
    expect(sql).toContain('contributor_review_invalid_transition');
    expect(sql).toContain('enforce_admin_event_status_rules');
  });
});
