import type {
  CityRecord,
  CollectionRecord,
  GenreRecord,
  SourceRecord,
} from '@/data/types/records';
import type { ImportSourceConfig } from '@/features/import/models/source-config';
import type { ImportJobStatus } from '@/features/import/models/statuses';

export interface GenreRow {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  active: boolean;
  sort_order: number;
}

export interface CityRow {
  id: string;
  name: string;
  slug: string;
  country: string;
  active: boolean;
}

export interface CollectionRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover: string | null;
  active: boolean;
  sort_order: number;
}

export interface SourceRow {
  id: string;
  name: string;
  type: string;
  website: string | null;
  source_url: string | null;
  source_config: ImportSourceConfig | null;
  default_timezone: string | null;
  trust_score: number;
  active: boolean;
  adapter_key: string | null;
  review_required: boolean;
  last_import_at: string | null;
  last_job_status: ImportJobStatus | null;
  next_scheduled_at: string | null;
}

export function mapGenreRowToRecord(row: GenreRow): GenreRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon ?? undefined,
    color: row.color ?? undefined,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

export function mapGenreRecordToRow(record: GenreRecord): GenreRow {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    icon: record.icon ?? null,
    color: record.color ?? null,
    active: record.active,
    sort_order: record.sortOrder,
  };
}

export function mapCityRowToRecord(row: CityRow): CityRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    country: row.country,
    active: row.active,
  };
}

export function mapCityRecordToRow(record: CityRecord): CityRow {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    country: record.country,
    active: record.active,
  };
}

export function mapCollectionRowToRecord(row: CollectionRow): CollectionRecord {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? undefined,
    cover: row.cover ?? undefined,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

export function mapCollectionRecordToRow(record: CollectionRecord): CollectionRow {
  return {
    id: record.id,
    title: record.title,
    slug: record.slug,
    description: record.description ?? null,
    cover: record.cover ?? null,
    active: record.active,
    sort_order: record.sortOrder,
  };
}

export function mapSourceRowToRecord(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    website: row.website ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    sourceConfig: row.source_config ?? undefined,
    defaultTimezone: row.default_timezone ?? undefined,
    trustScore: Number(row.trust_score),
    active: row.active,
    adapterKey: row.adapter_key ?? undefined,
    reviewRequired: row.review_required,
    lastImportAt: row.last_import_at ?? undefined,
    lastJobStatus: row.last_job_status ?? undefined,
    nextScheduledAt: row.next_scheduled_at ?? undefined,
  };
}

export function mapSourceRecordToRow(record: SourceRecord): SourceRow {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    website: record.website ?? null,
    source_url: record.sourceUrl ?? null,
    source_config: record.sourceConfig ?? null,
    default_timezone: record.defaultTimezone ?? null,
    trust_score: record.trustScore,
    active: record.active,
    adapter_key: record.adapterKey ?? null,
    review_required: record.reviewRequired ?? true,
    last_import_at: record.lastImportAt ?? null,
    last_job_status: record.lastJobStatus ?? null,
    next_scheduled_at: record.nextScheduledAt ?? null,
  };
}
