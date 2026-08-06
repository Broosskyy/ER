import type { AdminEventRepository } from '@/data/repositories/repositories';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { AdminEventRecord, PaginatedResult } from '@/data/types/records';

export interface SourceEventListItem {
  event: AdminEventRecord;
  originExternalId: string;
  originActive: boolean;
  isPrimarySource: boolean;
}

export class SourceEventsAdminService {
  constructor(
    private readonly sourceReferences: EventSourceReferenceRepository,
    private readonly adminEventRepository: AdminEventRepository,
  ) {}

  async listEventsForSource(
    sourceId: string,
    page = 1,
    pageSize = 20,
  ): Promise<PaginatedResult<SourceEventListItem>> {
    const origins = await this.sourceReferences.findBySourceId(sourceId);
    const byEventId = new Map<string, (typeof origins)[number]>();
    for (const origin of origins) {
      if (!origin.active || !origin.canonicalEventId) {
        continue;
      }
      const existing = byEventId.get(origin.canonicalEventId);
      if (!existing || origin.lastSeenAt > existing.lastSeenAt) {
        byEventId.set(origin.canonicalEventId, origin);
      }
    }

    const eventIds = [...byEventId.keys()].sort();
    const total = eventIds.length;
    const start = (page - 1) * pageSize;
    const pageIds = eventIds.slice(start, start + pageSize);

    const items: SourceEventListItem[] = [];
    for (const eventId of pageIds) {
      const origin = byEventId.get(eventId)!;
      const event = await this.adminEventRepository.getById(eventId);
      if (!event || event.status === 'archived') {
        continue;
      }
      items.push({
        event,
        originExternalId: origin.externalEventId,
        originActive: origin.active,
        isPrimarySource: event.sourceId === sourceId,
      });
    }

    items.sort((a, b) => a.event.startDate.localeCompare(b.event.startDate));

    return { items, total, page, pageSize };
  }

  async resolveEventIdsForSourceFilter(sourceId: string): Promise<Set<string>> {
    const origins = await this.sourceReferences.findBySourceId(sourceId);
    const ids = new Set<string>();
    for (const origin of origins) {
      if (origin.active && origin.canonicalEventId) {
        ids.add(origin.canonicalEventId);
      }
    }
    return ids;
  }
}
