import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase 4.6.7 legacy lineup artists migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260803100000_phase467_legacy_lineup_artists.sql'),
    'utf8',
  );

  it('adds lineup_legacy_artifact column and index', () => {
    expect(sql).toContain('lineup_legacy_artifact boolean not null default false');
    expect(sql).toContain('artists_lineup_legacy_artifact_idx');
  });

  it('excludes legacy artifacts from public artist reads', () => {
    expect(sql).toContain('anon_read_published_artists');
    expect(sql).toContain('lineup_legacy_artifact = false');
  });
});
