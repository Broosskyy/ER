import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Sprint 21 discovery engine migration', () => {
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260752000000_sprint21_discovery_engine_foundation.sql'),
    'utf8',
  );

  it('creates discovery composite indexes', () => {
    expect(sql).toContain('events_discovery_published_start_idx');
    expect(sql).toContain('events_discovery_city_start_idx');
    expect(sql).toContain('events_discovery_venue_start_idx');
  });

  it('prepares full-text search column and trigger', () => {
    expect(sql).toContain('search_document');
    expect(sql).toContain('events_search_document_gin_idx');
    expect(sql).toContain('events_search_document_trigger');
  });
});
