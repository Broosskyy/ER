import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Sprint 4.5 Bootshaus detail extraction migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260801000000_sprint45_bootshaus_detail_extraction.sql'),
    'utf8',
  );

  it('enables maxDetailPages for Bootshaus website source', () => {
    expect(sql).toContain("where id = 'source-bootshaus-koeln'");
    expect(sql).toContain('{website,limits,maxDetailPages}');
    expect(sql).toContain("'50'::jsonb");
  });

  it('adds allowedDomains for detail fetch security', () => {
    expect(sql).toContain('{website,eventDetailPage}');
    expect(sql).toContain("'bootshaus.tv'");
    expect(sql).toContain("'^/events/'");
  });
});
