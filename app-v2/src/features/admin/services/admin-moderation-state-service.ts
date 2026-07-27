import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  DuplicateReviewDecision,
  DuplicateReviewRecord,
  EventModerationStateRecord,
  ModerationQueueStatus,
} from '@/features/admin/types/moderation-types';

export const ADMIN_MODERATION_STATE_STORAGE_KEY = 'app.adminModerationState.v1';
export const ADMIN_DUPLICATE_REVIEW_STORAGE_KEY = 'app.adminDuplicateReview.v1';

function isModerationStateRecord(value: unknown): value is EventModerationStateRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as EventModerationStateRecord;
  return typeof record.eventId === 'string' && typeof record.queueStatus === 'string';
}

function isDuplicateReviewRecord(value: unknown): value is DuplicateReviewRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as DuplicateReviewRecord;
  return (
    typeof record.eventId === 'string' &&
    typeof record.candidateEventId === 'string' &&
    typeof record.decision === 'string'
  );
}

export class AdminModerationStateService {
  private moderationStates: EventModerationStateRecord[] = [];
  private duplicateReviews: DuplicateReviewRecord[] = [];
  private hydrated = false;

  private async hydrate(): Promise<void> {
    if (this.hydrated) {
      return;
    }

    try {
      const [statesRaw, duplicatesRaw] = await Promise.all([
        AsyncStorage.getItem(ADMIN_MODERATION_STATE_STORAGE_KEY),
        AsyncStorage.getItem(ADMIN_DUPLICATE_REVIEW_STORAGE_KEY),
      ]);

      if (statesRaw) {
        const parsed: unknown = JSON.parse(statesRaw);
        if (Array.isArray(parsed)) {
          this.moderationStates = parsed.filter(isModerationStateRecord);
        }
      }

      if (duplicatesRaw) {
        const parsed: unknown = JSON.parse(duplicatesRaw);
        if (Array.isArray(parsed)) {
          this.duplicateReviews = parsed.filter(isDuplicateReviewRecord);
        }
      }
    } catch {
      this.moderationStates = [];
      this.duplicateReviews = [];
    }

    this.hydrated = true;
  }

  private async persistStates(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ADMIN_MODERATION_STATE_STORAGE_KEY,
        JSON.stringify(this.moderationStates),
      );
    } catch {
      // In-memory fallback for test/runtime environments without AsyncStorage.
    }
  }

  private async persistDuplicates(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        ADMIN_DUPLICATE_REVIEW_STORAGE_KEY,
        JSON.stringify(this.duplicateReviews),
      );
    } catch {
      // In-memory fallback for test/runtime environments without AsyncStorage.
    }
  }

  async getState(eventId: string): Promise<EventModerationStateRecord | null> {
    await this.hydrate();
    return this.moderationStates.find((entry) => entry.eventId === eventId) ?? null;
  }

  async listStates(): Promise<EventModerationStateRecord[]> {
    await this.hydrate();
    return [...this.moderationStates];
  }

  async upsertState(input: {
    eventId: string;
    queueStatus: ModerationQueueStatus;
    reasonCode?: EventModerationStateRecord['reasonCode'];
    note?: string;
    markedBy?: string;
  }): Promise<EventModerationStateRecord> {
    await this.hydrate();
    const now = new Date().toISOString();
    const existingIndex = this.moderationStates.findIndex((entry) => entry.eventId === input.eventId);
    const next: EventModerationStateRecord = {
      eventId: input.eventId,
      queueStatus: input.queueStatus,
      reasonCode: input.reasonCode,
      note: input.note?.trim() || undefined,
      markedBy: input.markedBy,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      this.moderationStates[existingIndex] = next;
    } else {
      this.moderationStates.unshift(next);
    }

    await this.persistStates();
    return next;
  }

  async saveDuplicateDecision(input: {
    eventId: string;
    candidateEventId: string;
    decision: DuplicateReviewDecision;
    note?: string;
    decidedBy: string;
  }): Promise<DuplicateReviewRecord> {
    await this.hydrate();
    const record: DuplicateReviewRecord = {
      eventId: input.eventId,
      candidateEventId: input.candidateEventId,
      decision: input.decision,
      note: input.note?.trim() || undefined,
      decidedBy: input.decidedBy,
      decidedAt: new Date().toISOString(),
    };

    const existingIndex = this.duplicateReviews.findIndex(
      (entry) =>
        entry.eventId === input.eventId && entry.candidateEventId === input.candidateEventId,
    );

    if (existingIndex >= 0) {
      this.duplicateReviews[existingIndex] = record;
    } else {
      this.duplicateReviews.unshift(record);
    }

    await this.persistDuplicates();
    return record;
  }

  async listDuplicateDecisions(eventId: string): Promise<DuplicateReviewRecord[]> {
    await this.hydrate();
    return this.duplicateReviews.filter((entry) => entry.eventId === eventId);
  }

  clear(): void {
    this.moderationStates = [];
    this.duplicateReviews = [];
    this.hydrated = true;
  }
}
