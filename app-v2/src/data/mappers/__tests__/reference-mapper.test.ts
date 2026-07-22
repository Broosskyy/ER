import { describe, expect, it } from 'vitest';

import {
  mapCityRecordToRow,
  mapCityRowToRecord,
  mapCollectionRecordToRow,
  mapCollectionRowToRecord,
  mapGenreRecordToRow,
  mapGenreRowToRecord,
  mapSourceRecordToRow,
  mapSourceRowToRecord,
} from '@/data/mappers/reference-mapper';

describe('reference mapper', () => {
  it('maps genre rows to records and back', () => {
    const row = {
      id: 'genre-1',
      name: 'Techno',
      slug: 'techno',
      icon: 'pulse',
      color: '#7C3AED',
      active: true,
      sort_order: 1,
    };

    const record = mapGenreRowToRecord(row);
    expect(record.sortOrder).toBe(1);
    expect(mapGenreRecordToRow(record)).toEqual(row);
  });

  it('maps city rows to records and back', () => {
    const row = {
      id: 'city-1',
      name: 'Berlin',
      slug: 'berlin',
      country: 'Germany',
      active: true,
    };

    const record = mapCityRowToRecord(row);
    expect(record.name).toBe('Berlin');
    expect(mapCityRecordToRow(record)).toEqual(row);
  });

  it('maps collection rows to records and back', () => {
    const row = {
      id: 'collection-1',
      title: 'Weekend Picks',
      slug: 'weekend-picks',
      description: 'Highlights',
      cover: 'https://example.com/cover.jpg',
      active: true,
      sort_order: 2,
    };

    const record = mapCollectionRowToRecord(row);
    expect(record.sortOrder).toBe(2);
    expect(mapCollectionRecordToRow(record)).toEqual(row);
  });

  it('maps source rows to records and back', () => {
    const row = {
      id: 'src-1',
      name: 'RA Feed',
      type: 'feed',
      website: 'https://ra.co',
      source_url: 'https://ra.co/feed',
      source_config: { feed: { feedUrl: 'https://ra.co/feed' } },
      default_timezone: 'Europe/Berlin',
      trust_score: 80,
      active: true,
      adapter_key: 'rss',
      review_required: true,
      last_import_at: '2026-07-21T10:00:00.000Z',
      last_job_status: 'completed' as const,
      next_scheduled_at: null,
    };

    const record = mapSourceRowToRecord(row);
    expect(record.trustScore).toBe(80);
    expect(record.sourceUrl).toBe('https://ra.co/feed');
    expect(mapSourceRecordToRow(record)).toEqual(row);
  });
});
