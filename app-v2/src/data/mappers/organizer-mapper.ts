import type { OrganizerRecord, OrganizerListParams, PaginatedResult } from '@/data/types/records';

export interface OrganizerRow {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  soundcloud?: string | null;
  resident_advisor?: string | null;
  logo_url?: string | null;
  city?: string | null;
  country?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicOrganizerProjection {
  id: string;
  slug: string;
  name: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  soundcloud?: string;
  residentAdvisor?: string;
  logoUrl?: string;
}

export function mapOrganizerRowToRecord(row: OrganizerRow): OrganizerRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description ?? undefined,
    website: row.website ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    instagram: row.instagram ?? undefined,
    facebook: row.facebook ?? undefined,
    soundcloud: row.soundcloud ?? undefined,
    residentAdvisor: row.resident_advisor ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    city: row.city ?? undefined,
    country: row.country ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapOrganizerRecordToRow(record: OrganizerRecord): OrganizerRow {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description ?? null,
    website: record.website ?? null,
    email: record.email ?? null,
    phone: record.phone ?? null,
    instagram: record.instagram ?? null,
    facebook: record.facebook ?? null,
    soundcloud: record.soundcloud ?? null,
    resident_advisor: record.residentAdvisor ?? null,
    logo_url: record.logoUrl ?? null,
    city: record.city ?? null,
    country: record.country ?? null,
    notes: record.notes ?? null,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function mapOrganizerRecordToPublicProjection(
  record: OrganizerRecord,
): PublicOrganizerProjection {
  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    website: record.website,
    instagram: record.instagram,
    facebook: record.facebook,
    soundcloud: record.soundcloud,
    residentAdvisor: record.residentAdvisor,
    logoUrl: record.logoUrl,
  };
}

export function applyOrganizerListParams(
  items: OrganizerRecord[],
  params: OrganizerListParams,
): PaginatedResult<OrganizerRecord> {
  let filtered = [...items];
  const query = params.query?.trim().toLowerCase();

  if (query) {
    filtered = filtered.filter((organizer) => {
      const haystack = [
        organizer.name,
        organizer.slug,
        organizer.city,
        organizer.country,
        organizer.website,
        organizer.email,
        organizer.instagram,
        organizer.facebook,
        organizer.soundcloud,
        organizer.residentAdvisor,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  if (params.city?.trim()) {
    const city = params.city.trim().toLowerCase();
    filtered = filtered.filter((organizer) => organizer.city?.toLowerCase().includes(city));
  }

  if (params.country?.trim()) {
    const country = params.country.trim().toLowerCase();
    filtered = filtered.filter((organizer) => organizer.country?.toLowerCase().includes(country));
  }

  const sortBy = params.sortBy ?? 'name';
  filtered.sort((left, right) => {
    if (sortBy === 'updated') {
      return right.updatedAt.localeCompare(left.updatedAt);
    }
    if (sortBy === 'city') {
      return (left.city ?? '').localeCompare(right.city ?? '') || left.name.localeCompare(right.name);
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
