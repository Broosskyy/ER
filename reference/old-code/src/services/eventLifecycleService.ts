import { getSupabase } from '@/lib/supabase/client';
import { DbLifecycleStatus, EventRow } from '@/types/database';
import { ReviewAction } from '@/domain/event/status';
import { assertValidTransition } from '@/domain/event/status';
import { validateStatusTransition } from '@/validation/eventValidation';
import { eventRepository } from '@/repositories/eventRepository';
import { ServiceResult } from './types';

export interface LifecycleTransitionOptions {
  reviewedBy?: string;
  note?: string;
  skipValidation?: boolean;
}

async function logReviewAudit(
  eventId: string,
  actorId: string | undefined,
  action: ReviewAction,
  from: DbLifecycleStatus,
  to: DbLifecycleStatus,
  note?: string
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !actorId) return;

  await supabase.from('event_review_audit').insert({
    event_id: eventId,
    actor_id: actorId,
    action,
    from_status: from,
    to_status: to,
    note: note ?? null,
  });
}

function timestampForStatus(status: DbLifecycleStatus): Partial<EventRow> {
  const now = new Date().toISOString();
  switch (status) {
    case 'published':
      return { published_at: now };
    case 'archived':
      return { archived_at: now };
    case 'deleted':
      return { deleted_at: now };
    default:
      return {};
  }
}

export async function transitionEventLifecycle(
  eventId: string,
  toStatus: DbLifecycleStatus,
  options: LifecycleTransitionOptions = {}
): Promise<ServiceResult<EventRow>> {
  const current = await eventRepository.findById(eventId);
  if (current.error) return { data: null, error: current.error, offline: false };
  if (!current.data) return { data: null, error: 'Event not found', offline: false };

  const fromStatus = current.data.status;

  if (!options.skipValidation) {
    const validation = validateStatusTransition(fromStatus, toStatus);
    if (!validation.valid) return { data: null, error: validation.errors.join('; '), offline: false };
    try {
      assertValidTransition(fromStatus, toStatus);
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : 'Invalid transition', offline: false };
    }
  }

  const patch: Partial<EventRow> = {
    lifecycle_status: toStatus,
    reviewed_at: new Date().toISOString(),
    ...timestampForStatus(toStatus),
  };
  if (options.reviewedBy) patch.reviewed_by = options.reviewedBy;

  const result = await eventRepository.update(eventId, patch);
  if (result.data && options.reviewedBy) {
    const action = mapStatusToReviewAction(toStatus);
    if (action) await logReviewAudit(eventId, options.reviewedBy, action, fromStatus, toStatus, options.note);
  }

  return result;
}

function mapStatusToReviewAction(status: DbLifecycleStatus): ReviewAction | null {
  switch (status) {
    case 'approved':
      return 'approve';
    case 'rejected':
      return 'reject';
    case 'pending_review':
      return 'request_changes';
    case 'published':
      return 'publish';
    case 'archived':
      return 'archive';
    case 'deleted':
      return 'delete';
    default:
      return null;
  }
}

export async function approveEvent(eventId: string, reviewedBy: string, note?: string) {
  return transitionEventLifecycle(eventId, 'approved', { reviewedBy, note });
}

export async function rejectEvent(eventId: string, reviewedBy: string, note?: string) {
  return transitionEventLifecycle(eventId, 'rejected', { reviewedBy, note });
}

export async function requestChanges(eventId: string, reviewedBy: string, note?: string) {
  return transitionEventLifecycle(eventId, 'pending_review', { reviewedBy, note });
}

export async function publishEvent(eventId: string, reviewedBy: string, note?: string) {
  const current = await eventRepository.findById(eventId);
  if (current.data?.status === 'approved') {
    return transitionEventLifecycle(eventId, 'published', { reviewedBy, note });
  }
  if (current.data?.status === 'pending_review') {
    const approved = await transitionEventLifecycle(eventId, 'approved', { reviewedBy, note: 'Auto-approved for publish' });
    if (approved.error || !approved.data) return approved;
    return transitionEventLifecycle(eventId, 'published', { reviewedBy, note });
  }
  return transitionEventLifecycle(eventId, 'published', { reviewedBy, note });
}

export async function archiveEvent(eventId: string, reviewedBy?: string) {
  return transitionEventLifecycle(eventId, 'archived', { reviewedBy });
}

export async function softDeleteEvent(eventId: string, reviewedBy?: string) {
  return transitionEventLifecycle(eventId, 'deleted', { reviewedBy });
}

export async function fetchReviewAuditLog(eventId: string): Promise<ServiceResult<Record<string, unknown>[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('event_review_audit')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data ?? []) as Record<string, unknown>[], error: null, offline: false };
}
