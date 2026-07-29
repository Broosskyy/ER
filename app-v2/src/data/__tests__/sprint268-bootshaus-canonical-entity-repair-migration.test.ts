import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Sprint 26.8 P0 Bootshaus canonical entity repair migration', () => {
  const sql = readFileSync(
    resolve(
      process.cwd(),
      'supabase/migrations/20260758000000_sprint268_bootshaus_canonical_entity_repair.sql',
    ),
    'utf8',
  );

  it('inserts production venue with narrow id/slug guard only', () => {
    expect(sql).toContain("'venue-bootshaus-koeln'");
    expect(sql).toContain("'bootshaus-koeln'");
    expect(sql).toContain("v.id = 'venue-bootshaus-koeln'");
    expect(sql).toContain("v.slug = 'bootshaus-koeln'");
    expect(sql).not.toContain("lower(v.name) = 'bootshaus'");
    expect(sql).toContain('on conflict (id) do nothing');
  });

  it('reuses existing köln city and copies staging coordinates when present', () => {
    expect(sql).toContain("city.id = 'staging-seed-city-koeln'");
    expect(sql).toContain("'staging-seed-venue-bootshaus'");
    expect(sql).toContain('staging.latitude');
    expect(sql).toContain('staging.longitude');
  });

  it('updates only bootshaus source venue defaults', () => {
    expect(sql).toContain("'venue-bootshaus-koeln'::text");
    expect(sql).toContain("'Bootshaus'::text");
    expect(sql).toContain("where id = 'source-bootshaus-koeln'");
    expect(sql).not.toMatch(/update public\.venues\s+set/i);
    expect(sql).not.toMatch(/delete from/i);
  });
});
