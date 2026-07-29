import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Sprint 28.1 Affenkäfig live domain migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260761000000_sprint281_affenkaefig_live_domain.sql'),
    'utf8',
  );

  it('switches source URLs to affenkaefig.info tickets page', () => {
    expect(sql).toContain('https://affenkaefig.info/tickets/');
    expect(sql).toContain("'officialDomain', 'affenkaefig.info'");
    expect(sql).toContain("'legacyDomain', 'affenkaefig.de'");
  });

  it('configures event_detail_page with json_ld detail strategy', () => {
    expect(sql).toContain("'preferredStrategy', 'event_detail_page'");
    expect(sql).toContain("'detailStrategy', 'json_ld'");
    expect(sql).toContain("'linkIncludePattern', '/event/'");
    expect(sql).toContain("'maxDetailPages', 50");
  });

  it('keeps source disabled with manual_review posture', () => {
    expect(sql).toContain("where id = 'source-affenkaefig'");
    expect(sql).toContain('enabled = false');
    expect(sql).toContain('schedule_enabled = false');
    expect(sql).toContain('publish_mode = \'manual_review\'');
  });

  it('does not embed fixture HTML', () => {
    expect(sql).not.toContain('Warehouse Session');
    expect(sql).not.toContain('application/ld+json');
  });
});
