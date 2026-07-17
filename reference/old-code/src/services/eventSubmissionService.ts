import { getSupabase } from '@/lib/supabase/client';
import { EventRow } from '@/types/database';
import { EventEntity, EventSubmissionInput } from '@/domain/event/types';
import { eventRepository } from '@/repositories/eventRepository';
import { eventRowToEntity, entityToEventRowPatch } from '@/utils/eventEntityMapper';
import { validateEventSubmission } from '@/validation/eventValidation';
import { transitionEventLifecycle } from '@/services/eventLifecycleService';
import { PublicEventFormData } from '@/types/lifecycle';
import { buildEndDatetime, buildStartDatetime } from '@/utils/eventMappers';
import { resolveDuplicateForInput } from '@/services/events';
import { duplicateInputFromForm } from '@/utils/duplicateDetection';
import { ServiceResult } from './types';

async function saveSubmissionSnapshot(eventId: string, userId: string, row: EventRow): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase.from('event_submission_history').insert({
    event_id: eventId,
    submitted_by: userId,
    status: row.lifecycle_status,
    snapshot: row as unknown as Record<string, unknown>,
  });
}

export function formDataToSubmissionInput(form: PublicEventFormData): EventSubmissionInput {
  return {
    title: form.title,
    description: form.description,
    schedule: {
      startDatetime: buildStartDatetime(form.date, form.startTime),
      endDatetime: buildEndDatetime(form.date, form.endTime),
      timezone: 'Europe/Berlin',
    },
    address: {
      venueName: form.venue,
      city: form.city,
      country: form.country || 'Germany',
      formatted: form.address,
    },
    genres: form.genres,
    tags: [],
    eventType: form.eventType,
    minAge: form.ageRestriction,
    price: parseFloat(form.price) || 0,
    ticketUrl: form.ticketLink,
    lineup: form.lineup.split(',').map((s) => s.trim()).filter(Boolean),
    sourceType: 'user_submission',
  };
}

export async function submitEvent(
  userId: string,
  input: EventSubmissionInput
): Promise<ServiceResult<EventEntity>> {
  const validation = validateEventSubmission(input);
  if (!validation.valid) return { data: null, error: validation.errors.join('; '), offline: false };

  const dupInput = {
    title: input.title,
    city: input.address.city,
    venue: input.address.venueName,
    date: input.schedule.startDatetime.split('T')[0],
    ticket_link: input.ticketUrl ?? undefined,
  };

  const { storage } = await resolveDuplicateForInput(dupInput, { defaultLifecycle: 'pending_review' });

  const row = {
    title: input.title,
    description: input.description ?? null,
    start_datetime: input.schedule.startDatetime,
    end_datetime: input.schedule.endDatetime ?? null,
    timezone: input.schedule.timezone,
    city: input.address.city,
    country: input.address.country,
    venue_name: input.address.venueName,
    address: input.address.formatted ?? null,
    genres: input.genres,
    tags: input.tags ?? [],
    event_type: input.eventType ?? null,
    age_restriction: input.minAge ?? null,
    price: input.price ?? null,
    ticket_url: input.ticketUrl ?? null,
    lifecycle_status: storage.lifecycle_status ?? 'pending_review',
    created_by: userId,
    source_type: input.sourceType ?? 'user_submission',
    duplicate_of_event_id: storage.duplicate_of_event_id,
    duplicate_warning: storage.duplicate_warning,
    confidence_score: storage.confidence_score,
  };

  const result = await eventRepository.insert(row);
  if (result.error || !result.data) return { data: null, error: result.error, offline: result.offline };

  if (input.lineup.length) await eventRepository.replaceLineup(result.data.id, input.lineup);
  await saveSubmissionSnapshot(result.data.id, userId, result.data);

  return { data: eventRowToEntity(result.data, input.lineup), error: null, offline: false };
}

export async function updateSubmission(
  eventId: string,
  userId: string,
  input: Partial<EventSubmissionInput>
): Promise<ServiceResult<EventEntity>> {
  const patch = entityToEventRowPatch(input as Partial<EventEntity>);
  const result = await eventRepository.update(eventId, patch);
  if (result.error || !result.data) return { data: null, error: result.error, offline: result.offline };

  if (input.lineup) await eventRepository.replaceLineup(eventId, input.lineup);
  await saveSubmissionSnapshot(eventId, userId, result.data);

  return eventRepository.findById(eventId).then((r) =>
    r.data
      ? { data: r.data, error: null, offline: r.offline }
      : { data: null, error: r.error ?? 'Event not found', offline: r.offline }
  );
}

export async function fetchUserSubmissions(userId: string): Promise<ServiceResult<EventEntity[]>> {
  return eventRepository.findMany({ createdBy: userId, sourceType: 'user_submission' }, { limit: 100 });
}

export async function resubmitForReview(eventId: string, userId: string): Promise<ServiceResult<EventEntity>> {
  const transition = await transitionEventLifecycle(eventId, 'pending_review', { reviewedBy: userId });
  if (transition.error || !transition.data) return { data: null, error: transition.error, offline: transition.offline };
  await saveSubmissionSnapshot(eventId, userId, transition.data);
  return { data: eventRowToEntity(transition.data), error: null, offline: false };
}

/** Bridge for existing PublicEventFormData flows */
export async function submitPublicEventForm(
  userId: string,
  form: PublicEventFormData
): Promise<ServiceResult<EventEntity>> {
  return submitEvent(userId, formDataToSubmissionInput(form));
}

export async function fetchSubmissionHistory(eventId: string): Promise<ServiceResult<Record<string, unknown>[]>> {
  const supabase = getSupabase();
  if (!supabase) return { data: null, error: null, offline: true };

  const { data, error } = await supabase
    .from('event_submission_history')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error: error.message, offline: false };
  return { data: (data ?? []) as Record<string, unknown>[], error: null, offline: false };
}
