import type { ArtistRecord, ArtistListParams, PaginatedResult } from '@/data/types/records';
import type { ArtistDatasource } from '@/data/datasources/types';
import { applyArtistListParams } from '@/data/mappers/artist-mapper';
import { isPublishedArtistStatus } from '@/features/artists/types/artist-status';
import { slugify } from '@/features/events/formatting/text';

function createDefaultArtistRecord(name: string, index: number): ArtistRecord {
  const now = new Date().toISOString();
  const slug = slugify(name) || `artist-${index + 1}`;

  return {
    id: `artist-${index + 1}`,
    name,
    slug,
    genreIds: [],
    status: 'published',
    verificationStatus: 'unverified',
    createdAt: now,
    updatedAt: now,
  };
}

export function buildLocalArtistsFromEventNames(names: Iterable<string>): ArtistRecord[] {
  const seen = new Map<string, ArtistRecord>();
  let index = 0;

  for (const name of names) {
    if (!seen.has(name)) {
      seen.set(name, createDefaultArtistRecord(name, index));
      index += 1;
    }
  }

  return Array.from(seen.values());
}

export function createLocalArtistDatasource(
  getItems: () => ArtistRecord[],
  setItems: (items: ArtistRecord[]) => void,
): ArtistDatasource {
  return {
    async getAll() {
      return [...getItems()];
    },
    async getPublished() {
      return getItems().filter((artist) => isPublishedArtistStatus(artist.status));
    },
    async getById(id) {
      return getItems().find((artist) => artist.id === id) ?? null;
    },
    async getPublishedById(id) {
      const artist = await this.getById(id);
      return artist && isPublishedArtistStatus(artist.status) ? artist : null;
    },
    async getBySlug(slug) {
      return getItems().find((artist) => artist.slug === slug) ?? null;
    },
    async getPublishedBySlug(slug) {
      const artist = await this.getBySlug(slug);
      return artist && isPublishedArtistStatus(artist.status) ? artist : null;
    },
    async list(params: ArtistListParams): Promise<PaginatedResult<ArtistRecord>> {
      return applyArtistListParams(getItems(), params);
    },
    async save(item) {
      const items = getItems();
      const index = items.findIndex((entry) => entry.id === item.id);
      if (index >= 0) {
        items[index] = item;
      } else {
        items.push(item);
      }
      setItems(items);
      return item;
    },
  };
}
