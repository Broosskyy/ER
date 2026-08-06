import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 35 ticket.io production migration', () => {
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20260769000000_sprint35_ticket_io_production.sql',
  );

  it('sets explicit enrichment behavior and connector monitoring columns', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("id = 'source-bootshaus-ticket-io'");
    expect(sql).toContain('"enrichment"');
    expect(sql).toContain('unchanged_count');
    expect(sql).toContain('connector_version');
  });
});
