import type { AdminSourceRepository } from '@/data/repositories/repositories';
import type {
  EventLifecycleChangeRepository,
  EventLifecycleHistoryRepository,
} from '../domain/lifecycle-engine-types';
import { EventLifecycleResolver } from '@/features/events/lifecycle/event-lifecycle-resolver';
import type { EventLifecycleInput } from '@/features/events/lifecycle/lifecycle-types';
import type { AdminEventRecord } from '@/data/types/records';

export interface EventLifecycleAdminStatus {
  canonicalEventId: string;
  lifecycleStatus: string;
  historyCount: number;
  changeCount: number;
  lastChangeAt?: string;
  lastSourceId?: string;
  pendingReviewDecisions: number;
}

function toLifecycleInput(record: AdminEventRecord): EventLifecycleInput {
  return {
    editorialStatus: record.status,
    timezone: record.timezone ?? 'Europe/Berlin',
    startAt: record.startDate,
    endAt: record.endDate,
    doorsOpenAt: record.doorsOpenAt,
    salesStartAt: record.salesStartAt,
    salesEndAt: record.salesEndAt,
    cancelledAt: record.cancelledAt,
    postponedAt: record.postponedAt,
    publishedAt: record.publishedAt,
  };
}

export class EventLifecycleAdminService {
  constructor(
    private readonly sourceRepository: AdminSourceRepository,
    private readonly historyRepository: EventLifecycleHistoryRepository,
    private readonly changeRepository: EventLifecycleChangeRepository,
    private readonly lifecycleResolver = new EventLifecycleResolver(),
  ) {}

  async getEventStatus(event: AdminEventRecord): Promise<EventLifecycleAdminStatus> {
    const canonicalEventId = event.canonicalEventId ?? event.id;
    const history = await this.historyRepository.listByCanonicalEventId(canonicalEventId, 200);
    const changes = await this.changeRepository.listByCanonicalEventId(canonicalEventId, 500);
    const lastEntry = history[0];

    return {
      canonicalEventId,
      lifecycleStatus: this.lifecycleResolver.resolve(toLifecycleInput(event)).status,
      historyCount: history.length,
      changeCount: changes.length,
      lastChangeAt: lastEntry?.createdAt,
      lastSourceId: lastEntry?.sourceId,
      pendingReviewDecisions: history.filter((entry) => entry.decision === 'review_required').length,
    };
  }

  async listEventHistory(canonicalEventId: string, limit = 100) {
    return this.historyRepository.listByCanonicalEventId(canonicalEventId, limit);
  }

  async listEventChanges(canonicalEventId: string, limit = 200) {
    return this.changeRepository.listByCanonicalEventId(canonicalEventId, limit);
  }

  async listRecentHistory(limit = 100) {
    return this.historyRepository.listRecent(limit);
  }
}
