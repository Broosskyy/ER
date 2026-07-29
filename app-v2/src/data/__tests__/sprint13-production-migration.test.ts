import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 13 production integration migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260744000000_sprint13_production_integration.sql'),
    'utf8',
  );

  it('adds publish_mode and source_roles columns', () => {
    expect(sql).toContain('publish_mode');
    expect(sql).toContain('source_roles');
    expect(sql).toContain('country_code');
    expect(sql).toContain('last_error');
  });

  it('seeds Bootshaus and Affenkäfig production sources', () => {
    expect(sql).toContain("'source-bootshaus-koeln'");
    expect(sql).toContain("'source-affenkaefig'");
    expect(sql).toContain("array['club', 'venue']");
    expect(sql).toContain("array['organizer', 'festival']");
    expect(sql).toContain("'auto_publish'");
  });
});
