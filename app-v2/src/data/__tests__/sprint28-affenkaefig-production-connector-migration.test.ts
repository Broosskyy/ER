import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Sprint 28 Affenkäfig production connector migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260760000000_sprint28_affenkaefig_production_connector.sql'),
    'utf8',
  );

  it('seeds canonical organizer-affenkaefig', () => {
    expect(sql).toContain("'organizer-affenkaefig'");
    expect(sql).toContain("'affenkaefig'");
  });

  it('configures json_ld website connector without embedded fixture HTML', () => {
    expect(sql).toContain("'preferredStrategy', 'json_ld'");
    expect(sql).toContain("'connectorKey', 'organizer_website'");
    expect(sql).not.toContain('Warehouse Session');
  });

  it('keeps source disabled with manual_review posture', () => {
    expect(sql).toContain("where id = 'source-affenkaefig'");
    expect(sql).toContain('enabled = false');
    expect(sql).toContain('schedule_enabled = false');
    expect(sql).toContain('publish_mode = \'manual_review\'');
  });

  it('sets organizer defaults without fixed venueId', () => {
    expect(sql).toContain("'organizerName', 'Affenkäfig'");
    expect(sql).toContain("'organizerId'");
    expect(sql).not.toContain('venueId');
  });
});
