import type { ArtistRecord } from '@/data/types/records';
import type {
  ArtistLifecycleStatus,
  ArtistVerificationStatus,
} from '@/features/artists/types/artist-status';

export interface ArtistRow {
  id: string;
  name: string;
  slug: string;
  bio?: string | null;
  image_url?: string | null;
  genre_ids?: string[] | null;
  country?: string | null;
  city?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  soundcloud?: string | null;
  spotify?: string | null;
  status: ArtistLifecycleStatus;
  verification_status: ArtistVerificationStatus;
  lineup_legacy_artifact?: boolean;
  created_at: string;
  updated_at: string;
}

export function mapArtistRowToRecord(row: ArtistRow): ArtistRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    bio: row.bio ?? undefined,
    imageUrl: row.image_url ?? undefined,
    genreIds: row.genre_ids ?? [],
    country: row.country ?? undefined,
    city: row.city ?? undefined,
    website: row.website ?? undefined,
    instagram: row.instagram ?? undefined,
    facebook: row.facebook ?? undefined,
    soundcloud: row.soundcloud ?? undefined,
    spotify: row.spotify ?? undefined,
    status: row.status,
    verificationStatus: row.verification_status,
    lineupLegacyArtifact: row.lineup_legacy_artifact ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapArtistRecordToRow(record: ArtistRecord): ArtistRow {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    bio: record.bio ?? null,
    image_url: record.imageUrl ?? null,
    genre_ids: record.genreIds,
    country: record.country ?? null,
    city: record.city ?? null,
    website: record.website ?? null,
    instagram: record.instagram ?? null,
    facebook: record.facebook ?? null,
    soundcloud: record.soundcloud ?? null,
    spotify: record.spotify ?? null,
    status: record.status,
    verification_status: record.verificationStatus,
    lineup_legacy_artifact: record.lineupLegacyArtifact ?? false,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function applyArtistListParams(
  items: ArtistRecord[],
  params: {
    query?: string;
    status?: ArtistLifecycleStatus | 'all';
    sortBy?: 'name' | 'updated';
    page?: number;
    pageSize?: number;
  },
): { items: ArtistRecord[]; total: number; page: number; pageSize: number } {
  let filtered = [...items];
  const query = params.query?.trim().toLowerCase();

  if (query) {
    filtered = filtered.filter((artist) => {
      const haystack = [
        artist.name,
        artist.slug,
        artist.city,
        artist.country,
        artist.bio,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  if (params.status && params.status !== 'all') {
    filtered = filtered.filter((artist) => artist.status === params.status);
  }

  if (params.sortBy === 'name') {
    filtered.sort((left, right) => left.name.localeCompare(right.name));
  } else {
    filtered.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const start = (page - 1) * pageSize;

  return {
    items: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}
