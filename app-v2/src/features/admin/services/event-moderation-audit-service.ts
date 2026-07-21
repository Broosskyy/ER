export type EventModerationAuditAction = 'event_published' | 'event_rejected';

export interface EventModerationAuditEntry {
  id: string;
  actorId: string;
  eventId: string;
  action: EventModerationAuditAction;
  summary: string;
  note?: string;
  createdAt: string;
}

export interface LogEventModerationInput {
  actorId: string;
  eventId: string;
  action: EventModerationAuditAction;
  summary: string;
  note?: string;
}

function createAuditId(): string {
  return `event-audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class EventModerationAuditService {
  private readonly entries: EventModerationAuditEntry[] = [];

  async log(input: LogEventModerationInput): Promise<EventModerationAuditEntry> {
    const entry: EventModerationAuditEntry = {
      id: createAuditId(),
      actorId: input.actorId,
      eventId: input.eventId,
      action: input.action,
      summary: input.summary,
      note: input.note,
      createdAt: new Date().toISOString(),
    };

    this.entries.push(entry);
    return entry;
  }

  async logPublished(actorId: string, eventId: string, title: string): Promise<void> {
    await this.log({
      actorId,
      eventId,
      action: 'event_published',
      summary: `Contributor event "${title}" published.`,
    });
  }

  async logRejected(
    actorId: string,
    eventId: string,
    title: string,
    note?: string,
  ): Promise<void> {
    await this.log({
      actorId,
      eventId,
      action: 'event_rejected',
      summary: `Contributor event "${title}" rejected.`,
      note,
    });
  }

  listByEvent(eventId: string): EventModerationAuditEntry[] {
    return this.entries.filter((entry) => entry.eventId === eventId);
  }

  listAll(): EventModerationAuditEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries.length = 0;
  }
}
