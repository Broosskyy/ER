export type EventModerationAuditAction =
  | 'event_published'
  | 'event_rejected'
  | 'event_approved'
  | 'changes_requested'
  | 'marked_in_review';

export interface EventModerationAuditEntry {
  id: string;
  actorId: string;
  eventId: string;
  action: EventModerationAuditAction;
  summary: string;
  note?: string;
  reasonCode?: string;
  createdAt: string;
}

export interface LogEventModerationInput {
  actorId: string;
  eventId: string;
  action: EventModerationAuditAction;
  summary: string;
  note?: string;
  reasonCode?: string;
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
      reasonCode: input.reasonCode,
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
      summary: `Event „${title}“ veröffentlicht.`,
    });
  }

  async logApproved(actorId: string, eventId: string, title: string): Promise<void> {
    await this.log({
      actorId,
      eventId,
      action: 'event_approved',
      summary: `Event „${title}“ genehmigt.`,
    });
  }

  async logChangesRequested(
    actorId: string,
    eventId: string,
    title: string,
    note?: string,
    reasonCode?: string,
  ): Promise<void> {
    await this.log({
      actorId,
      eventId,
      action: 'changes_requested',
      summary: `Änderungen für „${title}“ angefordert.`,
      note,
      reasonCode,
    });
  }

  async logRejected(
    actorId: string,
    eventId: string,
    title: string,
    note?: string,
    reasonCode?: string,
  ): Promise<void> {
    await this.log({
      actorId,
      eventId,
      action: 'event_rejected',
      summary: `Event „${title}“ abgelehnt.`,
      note,
      reasonCode,
    });
  }

  async logMarkedInReview(actorId: string, eventId: string, title: string): Promise<void> {
    await this.log({
      actorId,
      eventId,
      action: 'marked_in_review',
      summary: `Event „${title}“ wird geprüft.`,
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
