import { DbLifecycleStatus } from '@/types/database';
import { EventDraftInput, EventEntity } from '@/domain/event/types';
import { eventRepository } from '@/repositories/eventRepository';
import { entityToEventRowPatch, eventRowToEntity } from '@/utils/eventEntityMapper';
import { validateEventDraft } from '@/validation/eventValidation';
import { transitionEventLifecycle } from '@/services/eventLifecycleService';
import { ServiceResult } from './types';

export async function createEventDraft(
  input: EventDraftInput,
  createdBy: string,
  organizerId?: string | null
): Promise<ServiceResult<EventEntity>> {
  const validation = validateEventDraft(input);
  if (!validation.valid) return { data: null, error: validation.errors.join('; '), offline: false };

  const row = {
    title: input.title,
    short_description: input.shortDescription ?? null,
    description: input.description ?? null,
    start_datetime: input.schedule.startDatetime,
    end_datetime: input.schedule.endDatetime ?? null,
    timezone: input.schedule.timezone ?? 'Europe/Berlin',
    city: input.address.city,
    country: input.address.country,
    venue_name: input.address.venueName,
    street: input.address.street ?? null,
    house_number: input.address.houseNumber ?? null,
    postal_code: input.address.postalCode ?? null,
    state: input.address.state ?? null,
    address: input.address.formatted ?? null,
    latitude: input.address.latitude ?? null,
    longitude: input.address.longitude ?? null,
    genres: input.genres ?? [],
    tags: input.tags ?? [],
    event_type: input.eventType ?? null,
    age_restriction: input.minAge ?? null,
    price: input.price ?? null,
    ticket_url: input.ticketUrl ?? null,
    flyer_url: input.media?.coverImageUrl ?? null,
    gallery_urls: input.media?.galleryUrls ?? [],
    lifecycle_status: 'draft' as DbLifecycleStatus,
    created_by: createdBy,
    organizer_id: organizerId ?? null,
    source_type: input.automation?.sourceType ?? 'organizer',
  };

  const result = await eventRepository.insert(row);
  if (result.error || !result.data) return { data: null, error: result.error, offline: result.offline };

  if (input.lineup?.length) {
    await eventRepository.replaceLineup(result.data.id, input.lineup);
  }

  return { data: eventRowToEntity(result.data, input.lineup ?? []), error: null, offline: false };
}

export async function updateEventDraft(
  eventId: string,
  input: Partial<EventDraftInput>
): Promise<ServiceResult<EventEntity>> {
  const validation = validateEventDraft(input);
  if (!validation.valid) return { data: null, error: validation.errors.join('; '), offline: false };

  const patch = entityToEventRowPatch(input as Partial<EventEntity>);
  const result = await eventRepository.update(eventId, patch);
  if (result.error || !result.data) return { data: null, error: result.error, offline: result.offline };

  if (input.lineup) await eventRepository.replaceLineup(eventId, input.lineup);

  const entity = await eventRepository.findById(eventId);
  if (!entity.data) return { data: null, error: entity.error ?? 'Event not found', offline: entity.offline };
  return { data: entity.data, error: null, offline: false };
}

export async function deleteEventDraft(eventId: string): Promise<ServiceResult<EventEntity>> {
  const result = await eventRepository.deleteSoft(eventId);
  if (result.error || !result.data) return { data: null, error: result.error, offline: result.offline };
  return { data: eventRowToEntity(result.data), error: null, offline: false };
}

export async function submitDraftForReview(
  eventId: string,
  reviewedBy?: string
): Promise<ServiceResult<EventEntity>> {
  const transition = await transitionEventLifecycle(eventId, 'pending_review', { reviewedBy });
  if (transition.error || !transition.data) return { data: null, error: transition.error, offline: transition.offline };
  return { data: eventRowToEntity(transition.data), error: null, offline: false };
}

export async function fetchDraftsByUser(userId: string): Promise<ServiceResult<EventEntity[]>> {
  return eventRepository.findMany(
    { createdBy: userId, status: ['draft', 'imported_draft'] },
    { limit: 100 }
  );
}
