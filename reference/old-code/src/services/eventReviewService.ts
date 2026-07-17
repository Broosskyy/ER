import { EventEntity } from '@/domain/event/types';
import { isReviewQueueStatus } from '@/domain/event/status';
import { eventRepository } from '@/repositories/eventRepository';
import {
  approveEvent,
  archiveEvent,
  fetchReviewAuditLog,
  publishEvent,
  rejectEvent,
  requestChanges,
  transitionEventLifecycle,
} from '@/services/eventLifecycleService';
import { ServiceResult } from './types';

export async function fetchReviewQueue(): Promise<ServiceResult<EventEntity[]>> {
  const result = await eventRepository.findMany(
    {
      status: ['draft', 'pending_review', 'imported_draft', 'needs_review', 'approved', 'rejected', 'duplicate'],
    },
    { limit: 200 }
  );
  if (!result.data) return result;
  return {
    ...result,
    data: result.data.filter((e) => isReviewQueueStatus(e.status) || e.status === 'rejected' || e.status === 'duplicate'),
  };
}

export async function fetchReviewDetail(eventId: string): Promise<ServiceResult<EventEntity | null>> {
  return eventRepository.findById(eventId);
}

export {
  approveEvent,
  rejectEvent,
  requestChanges,
  publishEvent,
  archiveEvent,
  fetchReviewAuditLog,
  transitionEventLifecycle,
};
