import type { Event } from '@/features/events/types/event';

/**
 * Event repository stub for the clean rebuild.
 * Returns no events until the new event-core read path is implemented.
 */
export class EventRepository {
  private initialized = false;

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  initializeSync(_events: Event[]): void {
    this.initialized = true;
  }

  resetForTesting(): void {
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getPublishedEvents(): Event[] {
    return [];
  }

  getEventById(_id: string): Event | undefined {
    return undefined;
  }

  hasPublishedEvent(_id: string): boolean {
    return false;
  }

  getEventsForMap(): Event[] {
    return [];
  }

  resolveCanonicalId(eventId: string): string {
    return eventId;
  }

  applyCanonicalAliases(_aliases: Map<string, string>): void {
    // No-op until multi-source identity is reintroduced on the new core.
  }
}
