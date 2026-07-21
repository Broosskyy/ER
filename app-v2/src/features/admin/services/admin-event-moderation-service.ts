import { AppError } from '@/core/errors/app-error';
import type { AdminEventRecord } from '@/data/types/records';
import type { AdminEventRepository } from '@/data/repositories/repositories';
import {
  canAdminModerateTransition,
  isContributorSubmission,
} from '@/features/admin/constants/admin-event-status';
import { canPublishEvents } from '@/features/admin/admin-permissions';
import type { EventModerationAuditService } from '@/features/admin/services/event-moderation-audit-service';
import { resolveAdminRole, type AdminRole } from '@/features/import/admin/admin-roles';
import type { AuthSession } from '@/services/supabase/auth-service';

export class AdminEventModerationError extends AppError {
  constructor(message: string, code: 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION' = 'VALIDATION') {
    super(message, { code });
  }
}

function assertModerationPermission(role: AdminRole | null): asserts role is AdminRole {
  if (!canPublishEvents(role)) {
    throw new AdminEventModerationError(
      'Your role cannot publish or reject contributor events.',
      'FORBIDDEN',
    );
  }
}

function assertReviewContributorEvent(record: AdminEventRecord | null): AdminEventRecord {
  if (!record) {
    throw new AdminEventModerationError('Event not found.', 'NOT_FOUND');
  }

  if (record.status !== 'review') {
    throw new AdminEventModerationError('Only events in review can be moderated.', 'VALIDATION');
  }

  if (!isContributorSubmission(record)) {
    throw new AdminEventModerationError(
      'Only contributor submissions can be moderated through this workflow.',
      'VALIDATION',
    );
  }

  return record;
}

function assertPublishable(record: AdminEventRecord): void {
  if (!record.title.trim()) {
    throw new AdminEventModerationError('Event title is required before publishing.', 'VALIDATION');
  }

  if (!record.startDate.trim()) {
    throw new AdminEventModerationError('Event start date is required before publishing.', 'VALIDATION');
  }
}

export class AdminEventModerationService {
  constructor(
    private readonly eventRepository: AdminEventRepository,
    private readonly auditService: EventModerationAuditService,
  ) {}

  private role(session: AuthSession | null): AdminRole | null {
    return resolveAdminRole(session);
  }

  private actorId(session: AuthSession): string {
    return session.user.id;
  }

  async listReviewQueue(session: AuthSession | null): Promise<AdminEventRecord[]> {
    const role = this.role(session);
    if (!role) {
      throw new AdminEventModerationError('Admin session required.', 'FORBIDDEN');
    }

    const result = await this.eventRepository.list({
      status: 'review',
      sortBy: 'updated',
      page: 1,
      pageSize: 100,
    });

    return result.items.filter(isContributorSubmission);
  }

  async getReviewEvent(session: AuthSession | null, eventId: string): Promise<AdminEventRecord> {
    const role = this.role(session);
    if (!role) {
      throw new AdminEventModerationError('Admin session required.', 'FORBIDDEN');
    }

    const record = await this.eventRepository.getById(eventId);
    return assertReviewContributorEvent(record);
  }

  async publishContributorEvent(
    session: AuthSession,
    eventId: string,
  ): Promise<AdminEventRecord> {
    assertModerationPermission(this.role(session));

    const existing = assertReviewContributorEvent(await this.eventRepository.getById(eventId));
    if (!canAdminModerateTransition(existing.status, 'published')) {
      throw new AdminEventModerationError('Event cannot be published from its current status.', 'VALIDATION');
    }

    assertPublishable(existing);

    const record: AdminEventRecord = {
      ...existing,
      status: 'published',
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.eventRepository.save(record, { source: 'moderation' });
    await this.auditService.logPublished(this.actorId(session), saved.id, saved.title);
    return saved;
  }

  async rejectContributorEvent(
    session: AuthSession,
    eventId: string,
    note?: string,
  ): Promise<AdminEventRecord> {
    assertModerationPermission(this.role(session));

    const existing = assertReviewContributorEvent(await this.eventRepository.getById(eventId));
    if (!canAdminModerateTransition(existing.status, 'rejected')) {
      throw new AdminEventModerationError('Event cannot be rejected from its current status.', 'VALIDATION');
    }

    const record: AdminEventRecord = {
      ...existing,
      status: 'rejected',
      updatedAt: new Date().toISOString(),
    };

    const saved = await this.eventRepository.save(record, { source: 'moderation' });
    await this.auditService.logRejected(
      this.actorId(session),
      saved.id,
      saved.title,
      note?.trim() || undefined,
    );
    return saved;
  }
}
