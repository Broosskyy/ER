import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Sprint 26.8 Bootshaus data quality migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260757000000_sprint268_bootshaus_data_quality_idempotency.sql'),
    'utf8',
  );

  it('ensures canonical Bootshaus entities without destructive updates', () => {
    expect(sql).toContain("insert into public.cities");
    expect(sql).toContain("'koeln'");
    expect(sql).toContain("'venue-bootshaus-koeln'");
    expect(sql).toContain("'bootshaus-koeln'");
    expect(sql).toContain("'organizer-bootshaus'");
    expect(sql).toContain('on conflict');
    expect(sql).toContain('slug');
    expect(sql).toContain("'Köln'");
    expect(sql).toContain("'Germany'");
    expect(sql).not.toMatch(/update public\.cities\s+set/i);
    expect(sql).not.toMatch(/update public\.venues\s+set/i);
    expect(sql).not.toMatch(/update public\.organizers\s+set/i);
  });

  it('sets required venue fields including slug, city and country', () => {
    expect(sql).toMatch(/insert into public\.venues[\s\S]*slug[\s\S]*city[\s\S]*country/);
    expect(sql).toContain("'bootshaus-koeln'");
    expect(sql).toContain("'club'");
    expect(sql).toContain("v.slug = 'bootshaus-koeln'");
  });

  it('resolves canonical entity ids in source_config defaults', () => {
    expect(sql).toContain("'venueId', coalesce(");
    expect(sql).toContain("'organizerId', coalesce(");
    expect(sql).toContain("'cityId', coalesce(");
  });

  it('adds source_config defaults and removes misleading venueSelector', () => {
    expect(sql).toContain("source_config = coalesce(source_config, '{}'::jsonb)");
    expect(sql).toContain("'defaults'");
    expect(sql).toContain("'cityName', 'Köln'");
    expect(sql).toContain("'organizerName', 'Bootshaus'");
    expect(sql).toContain("where id = 'source-bootshaus-koeln'");
    expect(sql).toContain("#- '{website,htmlSelector,venueSelector}'");
  });
});
