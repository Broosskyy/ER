import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  mapVenueRecordToRow,
  mapVenueRowToRecord,
  type VenueRow,
} from '@/data/mappers/venue-mapper';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260735000000_er009_venue_admin_foundation.sql',
);

describe('ER-009 venue admin migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('extends venues and scopes public reads to published events', () => {
    expect(sql).toContain('add column if not exists slug text');
    expect(sql).toContain('create unique index if not exists venues_slug_idx');
    expect(sql).toContain('anon_read_public_event_venues');
    expect(sql).toContain("e.status = 'published'");
  });
});

describe('venue mapper', () => {
  it('maps database rows to domain records', () => {
    const row: VenueRow = {
      id: 'venue-1',
      slug: 'gewoelbe',
      name: 'Gewölbe',
      street: 'Venloer Str.',
      house_number: '1',
      postal_code: '50672',
      city: 'Köln',
      state: null,
      country: 'Germany',
      latitude: 50.9,
      longitude: 6.9,
      website: null,
      capacity: 1200,
      notes: null,
      address: 'Venloer Str. 1',
      city_id: 'koeln',
      instagram: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const record = mapVenueRowToRecord(row);
    expect(record.houseNumber).toBe('1');
    expect(mapVenueRecordToRow(record).house_number).toBe('1');
  });
});
