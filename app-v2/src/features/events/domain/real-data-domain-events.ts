export type RealDataDomainEventType =
  | 'event_created'
  | 'event_updated'
  | 'event_cancelled'
  | 'event_postponed'
  | 'ticket_status_changed'
  | 'lineup_changed'
  | 'entity_followed'
  | 'entity_unfollowed'
  | 'followed_organizer_new_event'
  | 'new_event_for_followed_organizer'
  | 'new_event_for_followed_artist'
  | 'new_event_for_followed_venue';

export interface RealDataDomainEvent {
  id: string;
  type: RealDataDomainEventType;
  canonicalEventId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  sourceId?: string;
  entityType?: 'organizer' | 'venue' | 'artist';
  canonicalEntityId?: string;
}

export interface RealDataDomainEventBus {
  publish(event: RealDataDomainEvent): void;
  list(): RealDataDomainEvent[];
  listByType(type: RealDataDomainEventType): RealDataDomainEvent[];
}

export class InMemoryRealDataDomainEventBus implements RealDataDomainEventBus {
  private readonly events: RealDataDomainEvent[] = [];

  publish(event: RealDataDomainEvent): void {
    this.events.push(event);
  }

  list(): RealDataDomainEvent[] {
    return [...this.events];
  }

  listByType(type: RealDataDomainEventType): RealDataDomainEvent[] {
    return this.events.filter((event) => event.type === type);
  }
}

export function createDomainEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function publishEntityFollowDomainEvent(
  bus: RealDataDomainEventBus,
  input: {
    type: Extract<RealDataDomainEventType, 'entity_followed' | 'entity_unfollowed'>;
    entityType: 'organizer' | 'venue' | 'artist';
    canonicalEntityId: string;
    userId?: string;
    occurredAt?: string;
  },
): RealDataDomainEvent {
  const event: RealDataDomainEvent = {
    id: createDomainEventId(input.type),
    type: input.type,
    canonicalEventId: input.canonicalEntityId,
    canonicalEntityId: input.canonicalEntityId,
    entityType: input.entityType,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: {
      entityType: input.entityType,
      canonicalEntityId: input.canonicalEntityId,
      ...(input.userId ? { userId: input.userId } : {}),
      occurredAt: input.occurredAt ?? new Date().toISOString(),
    },
  };
  bus.publish(event);
  return event;
}
