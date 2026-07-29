import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Sprint 26.9.1 production closure migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260759000000_sprint2691_production_closure.sql'),
    'utf8',
  );

  it('adds canonical venue alias without deleting staging venue', () => {
    expect(sql).toContain('entity_identity_aliases');
    expect(sql).toContain("'venue-bootshaus-koeln'");
    expect(sql).not.toContain('delete from public.venues');
  });

  it('repairs bootshaus source events and import_records only', () => {
    expect(sql).toContain("source_id = 'source-bootshaus-koeln'");
    expect(sql).toContain("venue_id = 'staging-seed-venue-bootshaus'");
    expect(sql).toContain('matched_venue_id');
  });

  it('backfills search_document generically', () => {
    expect(sql).toContain('where search_document is null');
    expect(sql).toContain("to_tsvector('simple'");
  });
});
