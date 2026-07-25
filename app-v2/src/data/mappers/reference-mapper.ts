import type {
  CityRecord,
  CollectionRecord,
  GenreRecord,
} from '@/data/types/records';

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

export {
  mapSourceRecordToRow,
  mapSourceRowToRecord,
  type SourceRow,
} from '@/data/mappers/source-mapper';
