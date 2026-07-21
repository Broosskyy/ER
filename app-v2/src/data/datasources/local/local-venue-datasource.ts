import type { VenueRecord, VenueListParams, PaginatedResult } from '@/data/types/records';
import type { VenueDatasource } from '@/data/datasources/types';
import { applyVenueListParams } from '@/data/mappers/venue-mapper';
import { buildVenueSlugBase } from '@/features/venues/domain/venue-slug';
import { slugify } from '@/features/events/formatting/text';
import type { AdminEventRecord } from '@/data/types/records';

function createDefaultVenueRecord(
  name: string,
  index: number,
  city: string,
  country: string,
  address?: string,
  latitude?: number,
  longitude?: number,
): VenueRecord {
  const now = new Date().toISOString();
  const slug = slugify(name) || `venue-${index + 1}`;

  return {
    id: `venue-${index + 1}`,
    slug,
    name,
    street: address,
    city,
    country,
    latitude,
    longitude,
    address,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildLocalVenuesFromEvents(
  events: Array<{ venue: string; address?: string; city: string; latitude?: number; longitude?: number }>,
  defaultCity: string,
  defaultCountry: string,
): VenueRecord[] {
  const seen = new Map<string, VenueRecord>();
  let index = 0;

  for (const event of events) {
    const key = event.venue.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }

    seen.set(
      key,
      createDefaultVenueRecord(
        event.venue,
        index,
        event.city || defaultCity,
        defaultCountry,
        event.address,
        event.latitude,
        event.longitude,
      ),
    );
    index += 1;
  }

  return Array.from(seen.values());
}

export function createLocalVenueDatasource(
  getItems: () => VenueRecord[],
  setItems: (items: VenueRecord[]) => void,
  getAdminEvents: () => AdminEventRecord[],
): VenueDatasource {
  return {
    async getAll() {
      return [...getItems()];
    },
    async getById(id) {
      return getItems().find((venue) => venue.id === id) ?? null;
    },
    async getBySlug(slug) {
      return getItems().find((venue) => venue.slug === slug) ?? null;
    },
    async list(params) {
      return applyVenueListParams(getItems(), params);
    },
    async save(item) {
      const items = getItems();
      const index = items.findIndex((venue) => venue.id === item.id);
      const next = {
        ...item,
        slug: item.slug || buildVenueSlugBase(item.name),
        updatedAt: new Date().toISOString(),
      };
      if (index >= 0) {
        items[index] = next;
      } else {
        items.push(next);
      }
      setItems(items);
      return next;
    },
    async delete(id) {
      setItems(getItems().filter((venue) => venue.id !== id));
    },
    async countEventsForVenue(venueId) {
      return getAdminEvents().filter((event) => event.venueId === venueId).length;
    },
    async listEventIdsForVenue(venueId) {
      return getAdminEvents()
        .filter((event) => event.venueId === venueId)
        .map((event) => event.id);
    },
  };
}
