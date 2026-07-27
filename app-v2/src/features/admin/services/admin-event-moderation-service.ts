import { AppError } from '@/core/errors/app-error';
import type { AdminEventRecord } from '@/data/types/records';
import type { AdminEventRepository } from '@/data/repositories/repositories';
import {
  canAdminModerateTransition,
  isContributorSubmission,
} from '@/features/admin/constants/admin-event-status';
import { canPublishEvents } from '@/features/admin/admin-permissions';
import type { ModerationQueueStatus, ModerationReasonCode } from '@/features/admin/types/moderation-types';
import { resolveModerationQueueStatus } from '@/features/admin/utils/moderation-status';
import type { AdminModerationStateService } from '@/features/admin/services/admin-moderation-state-service';
import type { EventModerationAuditService } from '@/features/admin/services/event-moderation-audit-service';
import { resolveAdminRole, type AdminRole } from '@/features/import/admin/admin-roles';
import type { AuthSession } from '@/services/supabase/auth-service';
import type { SubmissionDisplayStatus } from '@/features/create/wizard/wizard-types';

export class AdminEventModerationError extends AppError {
  constructor(message: string, code: 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION' = 'VALIDATION') {
    super(message, { code });
  }
}

function assertModerationPermission(role: AdminRole | null): asserts role is AdminRole {
  if (!canPublishEvents(role)) {
    throw new AdminEventModerationError(
      'Deine Rolle darf Contributor-Events nicht moderieren.',
      'FORBIDDEN',
    );
  }
}

function assertReviewContributorEvent(record: AdminEventRecord | null): AdminEventRecord {
  if (!record) {
    throw new AdminEventModerationError('Event nicht gefunden.', 'NOT_FOUND');
  }

  if (record.status !== 'review' && record.status !== 'rejected') {
    throw new AdminEventModerationError(
      'Nur Events in Prüfung oder mit Änderungswunsch können moderiert werden.',
      'VALIDATION',
    );
  }

  if (!isContributorSubmission(record)) {
    throw new AdminEventModerationError(
      'Nur Contributor-Einreichungen können über diesen Workflow moderiert werden.',
      'VALIDATION',
    );
  }

  return record;
}

function assertPublishable(record: AdminEventRecord): void {
  if (!record.title.trim()) {
    throw new AdminEventModerationError('Titel ist vor der Veröffentlichung erforderlich.', 'VALIDATION');
  }

  if (!record.startDate.trim()) {
    throw new AdminEventModerationError(
      'Startdatum ist vor der Veröffentlichung erforderlich.',
      'VALIDATION',
    );
  }
}

async function syncSubmission(
  event: AdminEventRecord,
  displayStatus: SubmissionDisplayStatus,
  note?: string,
): Promise<void> {
  const { syncSubmissionAfterModeration } = await import(
    '@/features/create/wizard/event-submission-service'
  );
  await syncSubmissionAfterModeration(event, displayStatus, note);
}

export class AdminEventModerationService {
  constructor(
    private readonly eventRepository: AdminEventRepository,
    private readonly auditService: EventModerationAuditService,
    private readonly stateService: AdminModerationStateService,
  ) {}

  private role(session: AuthSession | null): AdminRole | null {
    return resolveAdminRole(session);
  }

  private actorId(session: AuthSession): string {
    return session.user.id;
  }

  async listContributorEvents(session: AuthSession | null): Promise<AdminEventRecord[]> {
    const role = this.role(session);
    if (!role) {
      throw new AdminEventModerationError('Admin-Sitzung erforderlich.', 'FORBIDDEN');
    }

    const result = await this.eventRepository.list({
      sortBy: 'updated',
      page: 1,
      pageSize: 200,
    });

    return result.items.filter(isContributorSubmission);
  }

  async listReviewQueue(session: AuthSession | null): Promise<AdminEventRecord[]> {
    const events = await this.listContributorEvents(session);
    const states = await this.stateService.listStates();
    const stateByEventId = new Map(states.map((entry) => [entry.eventId, entry]));

    return events.filter((event) => {
      const queueStatus = resolveModerationQueueStatus(event, stateByEventId.get(event.id)?.queueStatus);
      return queueStatus === 'pending' || queueStatus === 'in_review' || queueStatus === 'approved';
    });
  }

  async getReviewEvent(session: AuthSession | null, eventId: string): Promise<AdminEventRecord> {
    const role = this.role(session);
    if (!role) {
      throw new AdminEventModerationError('Admin-Sitzung erforderlich.', 'FORBIDDEN');
    }

    const record = await this.eventRepository.getById(eventId);
    if (!record || !isContributorSubmission(record)) {
      throw new AdminEventModerationError('Event nicht gefunden.', 'NOT_FOUND');
    }

    return record;
  }

  async markInReview(session: AuthSession, eventId: string): Promise<AdminEventRecord> {
    assertModerationPermission(this.role(session));
    const existing = assertReviewContributorEvent(await this.eventRepository.getById(eventId));

    await this.stateService.upsertState({
      eventId,
      queueStatus: 'in_review',
      markedBy: this.actorId(session),
    });
    await this.auditService.logMarkedInReview(this.actorId(session), eventId, existing.title);
    await syncSubmission(existing, 'in_review');

    return existing;
  }

  async approveContributorEvent(session: AuthSession, eventId: string): Promise<AdminEventRecord> {
    assertModerationPermission(this.role(session));
    const existing = assertReviewContributorEvent(await this.eventRepository.getById(eventId));

    await this.stateService.upsertState({
      eventId,
      queueStatus: 'approved',
      markedBy: this.actorId(session),
    });
    await this.auditService.logApproved(this.actorId(session), eventId, existing.title);
    await syncSubmission(existing, 'approved');

    return existing;
  }

  async requestChangesContributorEvent(
    session: AuthSession,
    eventId: string,
    input: { reasonCode: ModerationReasonCode; note?: string },
  ): Promise<AdminEventRecord> {
    assertModerationPermission(this.role(session));
    const existing = assertReviewContributorEvent(await this.eventRepository.getById(eventId));

    const record: AdminEventRecord = {
      ...existing,
      status: 'rejected',
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.eventRepository.save(record, { source: 'moderation' });
    await this.stateService.upsertState({
      eventId,
      queueStatus: 'needs_changes',
      reasonCode: input.reasonCode,
      note: input.note,
      markedBy: this.actorId(session),
    });
    await this.auditService.logChangesRequested(
      this.actorId(session),
      saved.id,
      saved.title,
      input.note,
      input.reasonCode,
    );
    await syncSubmission(saved, 'needs_changes', input.note);

    return saved;
  }

  async rejectContributorEvent(
    session: AuthSession,
    eventId: string,
    input?: { reasonCode?: ModerationReasonCode; note?: string },
  ): Promise<AdminEventRecord> {
    assertModerationPermission(this.role(session));
    const existing = assertReviewContributorEvent(await this.eventRepository.getById(eventId));

    if (!canAdminModerateTransition(existing.status, 'rejected')) {
      throw new AdminEventModerationError(
        'Event kann im aktuellen Status nicht abgelehnt werden.',
        'VALIDATION',
      );
    }

    const record: AdminEventRecord = {
      ...existing,
      status: 'rejected',
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.eventRepository.save(record, { source: 'moderation' });
    await this.stateService.upsertState({
      eventId,
      queueStatus: 'rejected',
      reasonCode: input?.reasonCode,
      note: input?.note,
      markedBy: this.actorId(session),
    });
    await this.auditService.logRejected(
      this.actorId(session),
      saved.id,
      saved.title,
      input?.note,
      input?.reasonCode,
    );
    await syncSubmission(saved, 'rejected', input?.note);

    return saved;
  }

  async publishContributorEvent(
    session: AuthSession,
    eventId: string,
  ): Promise<AdminEventRecord> {
    assertModerationPermission(this.role(session));

    const existing = await this.eventRepository.getById(eventId);
    if (!existing || !isContributorSubmission(existing)) {
      throw new AdminEventModerationError('Event nicht gefunden.', 'NOT_FOUND');
    }

    const state = await this.stateService.getState(eventId);
    const queueStatus = resolveModerationQueueStatus(existing, state?.queueStatus);
    if (existing.status !== 'review' || queueStatus !== 'approved') {
      throw new AdminEventModerationError(
        'Nur genehmigte Events können veröffentlicht werden.',
        'VALIDATION',
      );
    }

    if (!canAdminModerateTransition(existing.status, 'published')) {
      throw new AdminEventModerationError(
        'Event kann im aktuellen Status nicht veröffentlicht werden.',
        'VALIDATION',
      );
    }

    assertPublishable(existing);

    const record: AdminEventRecord = {
      ...existing,
      status: 'published',
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.eventRepository.save(record, { source: 'moderation' });
    await this.stateService.upsertState({
      eventId,
      queueStatus: 'published',
      markedBy: this.actorId(session),
    });
    await this.auditService.logPublished(this.actorId(session), saved.id, saved.title);
    await syncSubmission(saved, 'published');

    return saved;
  }

  async findPreparedDuplicateCandidates(
    session: AuthSession | null,
    eventId: string,
  ): Promise<AdminEventRecord[]> {
    const role = this.role(session);
    if (!role) {
      throw new AdminEventModerationError('Admin-Sitzung erforderlich.', 'FORBIDDEN');
    }

    const submission = await this.getReviewEvent(session, eventId);
    const allEvents = await this.listContributorEvents(session);

    return allEvents.filter((candidate) => {
      if (candidate.id === submission.id) {
        return false;
      }
      if (candidate.status !== 'published') {
        return false;
      }

      const sameTitle =
        candidate.title.trim().toLowerCase() === submission.title.trim().toLowerCase();
      const sameDate = candidate.startDate.slice(0, 10) === submission.startDate.slice(0, 10);
      return sameTitle || (sameDate && candidate.cityId === submission.cityId);
    });
  }

  async getDashboardCounts(
    session: AuthSession | null,
  ): Promise<Record<ModerationQueueStatus, number>> {
    const events = await this.listContributorEvents(session);
    const states = await this.stateService.listStates();
    const stateByEventId = new Map(states.map((entry) => [entry.eventId, entry]));

    const counts: Record<ModerationQueueStatus, number> = {
      pending: 0,
      in_review: 0,
      needs_changes: 0,
      approved: 0,
      published: 0,
      rejected: 0,
      archived: 0,
    };

    for (const event of events) {
      const queueStatus = resolveModerationQueueStatus(
        event,
        stateByEventId.get(event.id)?.queueStatus,
      );
      counts[queueStatus] += 1;
    }

    return counts;
  }
}
