import type { VenueRecord, VenueListParams, PaginatedResult } from '@/data/types/records';

export interface VenueRow {
  id: string;
  slug: string;
  name: string;
  street?: string | null;
  house_number?: string | null;
  postal_code?: string | null;
  city: string;
  state?: string | null;
  country: string;
  latitude?: number | null;
  longitude?: number | null;
  website?: string | null;
  capacity?: number | null;
  notes?: string | null;
  address?: string | null;
  city_id?: string | null;
  instagram?: string | null;
  created_at: string;
  updated_at: string;
}

export function mapVenueRowToRecord(row: VenueRow): VenueRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    street: row.street ?? undefined,
    houseNumber: row.house_number ?? undefined,
    postalCode: row.postal_code ?? undefined,
    city: row.city,
    state: row.state ?? undefined,
    country: row.country,
    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,
    website: row.website ?? undefined,
    capacity: row.capacity ?? undefined,
    notes: row.notes ?? undefined,
    address: row.address ?? undefined,
    cityId: row.city_id ?? undefined,
    instagram: row.instagram ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapVenueRecordToRow(record: VenueRecord): VenueRow {
  const streetLine = [record.street, record.houseNumber].filter(Boolean).join(' ').trim();
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    street: record.street ?? null,
    house_number: record.houseNumber ?? null,
    postal_code: record.postalCode ?? null,
    city: record.city,
    state: record.state ?? null,
    country: record.country,
    latitude: record.latitude ?? null,
    longitude: record.longitude ?? null,
    website: record.website ?? null,
    capacity: record.capacity ?? null,
    notes: record.notes ?? null,
    address: streetLine || record.address || null,
    city_id: record.cityId ?? null,
    instagram: record.instagram ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function applyVenueListParams(
  items: VenueRecord[],
  params: VenueListParams,
): PaginatedResult<VenueRecord> {
  let filtered = [...items];
  const query = params.query?.trim().toLowerCase();

  if (query) {
    filtered = filtered.filter((venue) => {
      const haystack = [
        venue.name,
        venue.slug,
        venue.city,
        venue.country,
        venue.street,
        venue.postalCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  if (params.city?.trim()) {
    const city = params.city.trim().toLowerCase();
    filtered = filtered.filter((venue) => venue.city.toLowerCase().includes(city));
  }

  if (params.country?.trim()) {
    const country = params.country.trim().toLowerCase();
    filtered = filtered.filter((venue) => venue.country.toLowerCase().includes(country));
  }

  const sortBy = params.sortBy ?? 'name';
  filtered.sort((left, right) => {
    if (sortBy === 'updated') {
      return right.updatedAt.localeCompare(left.updatedAt);
    }
    if (sortBy === 'city') {
      return left.city.localeCompare(right.city) || left.name.localeCompare(right.name);
    }
    return left.name.localeCompare(right.name);
  });

  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? 50);
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}
