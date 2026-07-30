import type { EventOrigin } from '@/features/events/domain/event-origin';
import type { EventOriginService } from '@/features/events/services/event-origin-service';
import type { Event } from '@/features/events/types/event';

export interface EventDetailOptions {
  includeOrigins?: boolean;
}

export interface EventDetailResult {
  event: Event;
  origins?: EventOrigin[];
}

export class EventDetailService {
  constructor(
    private readonly getEventById: (id: string) => Event | undefined,
    private readonly eventOriginService?: EventOriginService,
  ) {}

  async getById(eventId: string, options: EventDetailOptions = {}): Promise<EventDetailResult | null> {
    const event = this.getEventById(eventId);
    if (!event) {
      return null;
    }

    if (!options.includeOrigins || !this.eventOriginService) {
      return { event };
    }

    const origins = await this.eventOriginService.listByEventId(event.id);
    return { event, origins };
  }
}
