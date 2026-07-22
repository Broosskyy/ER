import type { OrganizerRecord, OrganizerListParams, PaginatedResult } from '@/data/types/records';
import type { OrganizerDatasource } from '@/data/datasources/types';
import { applyOrganizerListParams } from '@/data/mappers/organizer-mapper';
import { buildOrganizerSlugBase } from '@/features/organizers/domain/organizer-slug';
import type { AdminEventRecord } from '@/data/types/records';

function createDefaultOrganizerRecord(
  name: string,
  index: number,
  city?: string,
  country?: string,
): OrganizerRecord {
  const now = new Date().toISOString();
  const slug = `${buildOrganizerSlugBase(name)}-${index + 1}`;

  return {
    id: `organizer-${index + 1}`,
    slug,
    name,
    city,
    country,
    createdAt: now,
    updatedAt: now,
  };
}

export function buildLocalOrganizersFromEvents(
  events: Array<{ organizer?: string; city: string; country: string }>,
): OrganizerRecord[] {
  const seen = new Map<string, OrganizerRecord>();
  let index = 0;

  for (const event of events) {
    const name = event.organizer?.trim();
    if (!name) {
      continue;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.set(
      key,
      createDefaultOrganizerRecord(name, index, event.city, event.country),
    );
    index += 1;
  }

  return Array.from(seen.values());
}

export function createLocalOrganizerDatasource(
  getItems: () => OrganizerRecord[],
  setItems: (items: OrganizerRecord[]) => void,
  getAdminEvents: () => AdminEventRecord[],
): OrganizerDatasource {
  return {
    async getAll() {
      return [...getItems()];
    },
    async getById(id) {
      return getItems().find((organizer) => organizer.id === id) ?? null;
    },
    async getBySlug(slug) {
      return getItems().find((organizer) => organizer.slug === slug) ?? null;
    },
    async list(params) {
      return applyOrganizerListParams(getItems(), params);
    },
    async save(item) {
      const items = getItems();
      const index = items.findIndex((organizer) => organizer.id === item.id);
      const next = {
        ...item,
        slug: item.slug || buildOrganizerSlugBase(item.name),
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
      setItems(getItems().filter((organizer) => organizer.id !== id));
    },
    async countEventsForOrganizer(organizerId) {
      return getAdminEvents().filter((event) => event.organizerId === organizerId).length;
    },
    async listEventIdsForOrganizer(organizerId) {
      return getAdminEvents()
        .filter((event) => event.organizerId === organizerId)
        .map((event) => event.id);
    },
  };
}
