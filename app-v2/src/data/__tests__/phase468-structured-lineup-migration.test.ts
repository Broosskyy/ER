import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('phase468 structured lineup migration', () => {
  it('creates structured lineup tables with billing relations and backfill', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260803120000_phase468_structured_lineup_entries.sql',
      ),
      'utf8',
    );

    expect(sql).toContain('create table if not exists public.event_lineup_entries');
    expect(sql).toContain('create table if not exists public.event_lineup_entry_artists');
    expect(sql).toContain("'B2B'");
    expect(sql).toContain("'F2F'");
    expect(sql).toContain("'HOSTED_BY'");
    expect(sql).toContain("'SPECIAL_GUEST'");
    expect(sql).toContain('event_artists_backfill');
    expect(sql).toContain("md5('phase468-entry:' || ea.id)");
    expect(sql).not.toContain("'ele-backfill-' || ea.id");
    expect(sql).toContain('lineup_legacy_artifact');
    expect((sql.match(/with backfill_rows as/gi) ?? []).length).toBe(2);
  });

  it('grants service_role access to structured lineup tables', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20260803130000_phase468_structured_lineup_service_grants.sql',
      ),
      'utf8',
    );

    expect(sql).toContain('grant select, insert, update, delete on table public.event_lineup_entries to service_role');
    expect(sql).toContain(
      'grant select, insert, update, delete on table public.event_lineup_entry_artists to service_role',
    );
    expect(sql).toContain('grant select on table public.event_lineup_entries to anon, authenticated');
  });
});
