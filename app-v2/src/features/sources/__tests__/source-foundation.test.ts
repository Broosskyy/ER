import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  mapSourceRecordToRow,
  mapSourceRowToRecord,
  type SourceRow,
} from '@/data/mappers/source-mapper';
import {
  findStrongSourceDuplicate,
  findSourceDuplicateCandidates,
} from '@/features/sources/domain/source-duplicate';
import {
  buildSourceSlugBase,
  isValidSourceSlug,
  resolveUniqueSourceSlug,
} from '@/features/sources/domain/source-slug';
import { validateSourceInput } from '@/features/sources/domain/source-validation';
import type { SourceListParams, SourceRecord } from '@/data/types/records';
import { SourceService } from '@/features/sources/services/source-service';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260738000000_er012_source_acquisition_foundation.sql',
);

const baseSource = (overrides: Partial<SourceRecord> = {}): SourceRecord => ({
  id: 'src-1',
  slug: 'ra-feed',
  displayName: 'RA Feed',
  sourceType: 'rss',
  parserType: 'rss',
  acquisitionStrategy: 'manual',
  priority: 50,
  trustScore: 80,
  requiresAuthentication: false,
  enabled: true,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

function createRepository(initial: SourceRecord[] = []) {
  const items = [...initial];
  return {
    list: async (_params: SourceListParams) => ({ items, total: items.length, page: 1, pageSize: 50 }),
    getById: async (id: string) => items.find((item) => item.id === id) ?? null,
    getBySlug: async (slug: string) => items.find((item) => item.slug === slug) ?? null,
    getAll: async () => [...items],
    save: async (record: SourceRecord) => {
      const index = items.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        items[index] = record;
      } else {
        items.push(record);
      }
      return record;
    },
    archive: async (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const current = items[index]!;
      const archived: SourceRecord = { ...current, archived: true, enabled: false };
      items[index] = archived;
      return archived;
    },
    restore: async (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) return null;
      const current = items[index]!;
      const restored: SourceRecord = { ...current, archived: false };
      items[index] = restored;
      return restored;
    },
    countImportJobsForSource: async () => 0,
  };
}

describe('ER-012 source acquisition migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('evolves sources and extends import record provenance', () => {
    expect(sql).toContain('add column if not exists slug');
    expect(sql).toContain('add column if not exists source_type');
    expect(sql).toContain('sources_slug_idx');
    expect(sql).toContain('add column if not exists original_url');
    expect(sql).toContain('add column if not exists retrieved_at');
    expect(sql).not.toContain('drop table');
  });
});

describe('source slug helpers', () => {
  it('builds deterministic slug bases', () => {
    expect(buildSourceSlugBase('Resident Advisor')).toBe('resident-advisor');
    expect(isValidSourceSlug('resident-advisor')).toBe(true);
  });

  it('resolves slug collisions', () => {
    expect(resolveUniqueSourceSlug('feed', ['feed', 'feed-2'])).toBe('feed-3');
  });
});

describe('source validation', () => {
  it('requires a display name', () => {
    expect(() =>
      validateSourceInput({
        displayName: '   ',
        sourceType: 'rss',
        parserType: 'rss',
        acquisitionStrategy: 'manual',
        priority: 50,
        trustScore: 50,
      }),
    ).toThrow('Display name is required');
  });

  it('rejects archived enabled sources', () => {
    expect(() =>
      validateSourceInput({
        displayName: 'Feed',
        sourceType: 'rss',
        parserType: 'rss',
        acquisitionStrategy: 'manual',
        priority: 50,
        trustScore: 50,
        archived: true,
        enabled: true,
      }),
    ).toThrow('Archived sources cannot be enabled');
  });

  it('validates trust and priority ranges', () => {
    expect(() =>
      validateSourceInput({
        displayName: 'Feed',
        sourceType: 'rss',
        parserType: 'rss',
        acquisitionStrategy: 'manual',
        priority: 200,
        trustScore: 50,
      }),
    ).toThrow('Priority');
  });
});

describe('source duplicate detection', () => {
  it('flags slug and base URL duplicates', () => {
    const sources = [
      baseSource(),
      baseSource({ id: 'src-2', slug: 'other', baseUrl: 'https://ra.co/feed' }),
    ];

    expect(findStrongSourceDuplicate({ slug: 'ra-feed' }, sources)?.reason).toBe('slug');
    expect(
      findSourceDuplicateCandidates({ baseUrl: 'https://ra.co/feed/' }, sources).some(
        (candidate) => candidate.reason === 'base_url',
      ),
    ).toBe(true);
  });
});

describe('source mapper', () => {
  it('maps database rows to domain records', () => {
    const row: SourceRow = {
      id: 'src-1',
      slug: 'ra-feed',
      display_name: 'RA Feed',
      description: null,
      source_type: 'rss',
      base_url: 'https://ra.co/feed',
      parser_type: 'rss',
      acquisition_strategy: 'scheduled',
      polling_strategy: 'interval',
      polling_interval_minutes: 60,
      rate_limit_per_hour: null,
      priority: 70,
      trust_score: 80,
      requires_authentication: false,
      enabled: true,
      archived: false,
      notes: null,
      name: 'RA Feed',
      type: 'feed',
      website: 'https://ra.co',
      source_url: 'https://ra.co/feed',
      source_config: null,
      default_timezone: 'Europe/Berlin',
      active: true,
      adapter_key: 'rss',
      review_required: true,
      last_import_at: null,
      last_job_status: null,
      next_scheduled_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    };

    const record = mapSourceRowToRecord(row);
    expect(record.displayName).toBe('RA Feed');
    expect(mapSourceRecordToRow(record).slug).toBe('ra-feed');
  });
});

describe('SourceService', () => {
  it('creates sources with generated slugs', async () => {
    const service = new SourceService(createRepository());
    const created = await service.create('source_manager', {
      displayName: 'Berghain Website',
      sourceType: 'website',
      parserType: 'html',
      acquisitionStrategy: 'manual',
      priority: 50,
      trustScore: 60,
    });
    expect(created.slug).toBe('berghain-website');
  });

  it('blocks duplicate base URLs', async () => {
    const service = new SourceService(
      createRepository([baseSource({ baseUrl: 'https://ra.co/feed' })]),
    );
    await expect(
      service.create('source_manager', {
        displayName: 'Duplicate Feed',
        sourceType: 'rss',
        parserType: 'rss',
        acquisitionStrategy: 'manual',
        baseUrl: 'https://ra.co/feed',
        priority: 50,
        trustScore: 50,
      }),
    ).rejects.toThrow('base URL');
  });

  it('prevents enabling archived sources', async () => {
    const service = new SourceService(
      createRepository([baseSource({ archived: true, enabled: false })]),
    );
    await expect(service.setEnabled('source_manager', 'src-1', true)).rejects.toThrow('Archived');
  });
});
