import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  mapOrganizerRecordToRow,
  mapOrganizerRowToRecord,
  type OrganizerRow,
} from '@/data/mappers/organizer-mapper';

const migrationPath = path.resolve(
  __dirname,
  '../../../supabase/migrations/20260736000000_er010_organizer_domain_foundation.sql',
);

describe('ER-010 organizer domain migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates organizers and links events with scoped public reads', () => {
    expect(sql).toContain('create table if not exists public.organizers');
    expect(sql).toContain('add column if not exists organizer_id');
    expect(sql).toContain('add column if not exists organizer text');
    expect(sql).toContain('create unique index if not exists organizers_slug_idx');
    expect(sql).toContain('anon_read_public_event_organizers');
    expect(sql).toContain("e.status = 'published'");
    expect(sql).toContain('matched_organizer_id');
  });
});

describe('organizer mapper', () => {
  it('maps database rows to domain records', () => {
    const row: OrganizerRow = {
      id: 'organizer-1',
      slug: 'rave-rebels',
      name: 'Rave Rebels',
      description: 'Collective',
      website: 'https://example.com',
      email: 'hello@example.com',
      phone: null,
      instagram: '@raverebels',
      facebook: null,
      soundcloud: null,
      resident_advisor: 'https://ra.co/organizer',
      logo_url: 'https://example.com/logo.png',
      city: 'Köln',
      country: 'Germany',
      notes: 'Internal',
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const record = mapOrganizerRowToRecord(row);
    expect(record.residentAdvisor).toBe('https://ra.co/organizer');
    expect(mapOrganizerRecordToRow(record).resident_advisor).toBe('https://ra.co/organizer');
  });
});
